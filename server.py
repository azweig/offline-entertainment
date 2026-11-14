#!/usr/bin/env python3
"""
Offline Entertainment - servidor personal: guarda videos y musica en tu celular
para verlos sin conexion (YouTube, Facebook, Instagram, TikTok y mas).

- Pensado para correr en TU computadora o en TU servidor de casa. Sin servicios centrales.
- Requiere una clave privada. Si no defines OFFLINE_KEY, se genera una en el primer arranque
  y se guarda en tu carpeta de configuracion (permisos 600).
- El archivo se prepara en una carpeta temporal, se envia UNA vez al celular y se borra
  de inmediato. No hay biblioteca, historial ni registros en el servidor.
- YouTube (busqueda, playlists, canales) y enlaces de una lista cerrada de sitios
  (SITES). yt-dlp solo carga los extractores de esos sitios: nunca el generico.
  Antes de cada conexion se resuelve el nombre y se rechazan direcciones privadas,
  locales o de enlace local.

Uso:  python server.py [--port 8765] [--host 127.0.0.1]
"""
import argparse, base64, hmac, ipaddress, json, mimetypes, os, re, secrets, shutil, socket, sys, tempfile, threading, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, quote
from urllib.request import urlopen

import yt_dlp

STATIC = Path(__file__).resolve().parent / "static"
TMP_ROOT = Path(tempfile.gettempdir()) / "offline-entertainment-tmp"
KEY = ""   # se carga en main() con load_key()
TTL = 20 * 60
MAX_ACTIVE = 2
MAX_FILESIZE = 1_200_000_000   # bytes por archivo: unico tope de tamano (sin limite de duracion)
MAX_WORK = 3 * 3600            # una descarga que sigue trabajando tras 3 h se descarta
MAX_LIST = 200   # canciones por playlist/canal
YT_ID = re.compile(r"[\w-]{11}")
YT_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
            "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"}


# Otros sitios por enlace: (nombre, dominios, extractores de yt-dlp permitidos).
# Solo publicaciones publicas: no hay soporte para cookies ni cuentas.
SITES = [
    ("Facebook", ("facebook.com", "fb.watch"), ("facebook", "facebook:reel")),
    ("Instagram", ("instagram.com",), ("Instagram",)),
    ("TikTok", ("tiktok.com",), ("TikTok",)),
    ("X (Twitter)", ("x.com", "twitter.com"), ("twitter",)),
    ("Vimeo", ("vimeo.com",), ("vimeo",)),
    ("SoundCloud", ("soundcloud.com",), ("soundcloud",)),
    ("Dailymotion", ("dailymotion.com", "dai.ly"), ("dailymotion",)),
    ("Twitch", ("twitch.tv",), ("twitch:clips", "twitch:vod")),
    ("Bandcamp", ("bandcamp.com",), ("Bandcamp",)),
    ("Internet Archive", ("archive.org",), ("archive.org",)),
]
SITE_NAMES = ", ".join(["YouTube"] + [n for n, _, _ in SITES])


def site_link(raw: str) -> tuple[str, list[str], str] | None:
    """(sitio, extractores, URL limpia) si el enlace es de un sitio de la lista; si no, None.
    La URL se rearma: siempre https, sin usuario/clave, sin puerto y sin fragmento."""
    raw = (raw or "").strip()
    if len(raw) > 500:
        return None
    try:
        u = urlparse(raw)
        port = u.port
    except ValueError:
        return None
    host = (u.hostname or "").lower().rstrip(".")
    if u.scheme not in ("http", "https") or u.username or u.password or port not in (None, 80, 443):
        return None
    for name, domains, ies in SITES:
        if any(host == d or host.endswith("." + d) for d in domains):
            clean = f"https://{host}{u.path or '/'}" + (f"?{u.query}" if u.query else "")
            return name, [re.escape(i) for i in ies], clean
    return None


def friendly(exc: Exception) -> str:
    msg = re.sub(r"\x1b\[[0-9;]*m", "", str(exc)).split("; please report")[0].replace("ERROR: ", "")
    low = msg.lower()
    if "unsupported url" in low:
        return "Ese enlace no es de un video o cancion suelto (puede ser un perfil o una lista)."
    if any(w in low for w in ("logged-in", "login", "log in", "cookies", "authentication", "private")):
        return "Ese contenido pide iniciar sesion o es privado. Solo funciona con publicaciones publicas."
    if "ip address is blocked" in low or "not available in your country" in low:
        return "El sitio no deja ver esa publicacion desde tu pais o tu red."
    return msg[:300]


def youtube_id(raw: str) -> str | None:
    """Extrae el ID de un enlace de YouTube (o acepta el ID solo). Nada mas pasa."""
    raw = (raw or "").strip()
    if YT_ID.fullmatch(raw):
        return raw
    try:
        u = urlparse(raw)
    except ValueError:
        return None
    if u.scheme not in ("http", "https") or (u.hostname or "").lower() not in YT_HOSTS:
        return None
    host = u.hostname.lower()
    parts = [x for x in u.path.split("/") if x]
    if host == "youtu.be":
        cand = parts[0] if parts else ""
    elif parts[:1] == ["watch"]:
        cand = (parse_qs(u.query).get("v") or [""])[0]
    elif len(parts) >= 2 and parts[0] in ("shorts", "live", "embed", "v"):
        cand = parts[1]
    else:
        cand = ""
    return cand if YT_ID.fullmatch(cand) else None


BLOCKED_NETS = [ipaddress.ip_network(n) for n in (
    "0.0.0.0/8", "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "169.254.0.0/16", "100.64.0.0/10", "::/128", "::1/128", "fc00::/7", "fe80::/10")]


def blocked_ip(addr: str) -> bool:
    """True si la direccion es privada, local, de enlace local o no enrutable."""
    try:
        ip = ipaddress.ip_address(addr.split("%")[0])
    except ValueError:
        return True
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return (any(ip in n for n in BLOCKED_NETS if n.version == ip.version)
            or ip.is_private or ip.is_loopback or ip.is_link_local
            or ip.is_multicast or ip.is_reserved or ip.is_unspecified)


def check_url(url: str) -> str:
    """Resuelve el nombre ANTES de conectarse y rechaza destinos internos. Devuelve la URL."""
    host = urlparse(url).hostname
    if not host:
        raise ValueError("Enlace no valido")
    try:
        addrs = {ai[4][0] for ai in socket.getaddrinfo(host, None)}
    except socket.gaierror as exc:
        raise ValueError(f"No se pudo resolver {host}") from exc
    if not addrs or any(blocked_ip(a) for a in addrs):
        raise ValueError("Enlace bloqueado: apunta a una direccion privada o local")
    return url


def config_dir() -> Path:
    if os.environ.get("OFFLINE_CONFIG_DIR"):
        return Path(os.environ["OFFLINE_CONFIG_DIR"])
    if os.name == "nt":
        return Path(os.environ.get("APPDATA") or Path.home()) / "offline-entertainment"
    return Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config") / "offline-entertainment"


def load_key() -> tuple[str, Path | None]:
    """OFFLINE_KEY si existe; si no, la clave guardada; si no, genera una nueva (permisos 600)."""
    env = os.environ.get("OFFLINE_KEY", "").strip()
    if env:
        if len(env) < 12:
            raise SystemExit("OFFLINE_KEY debe tener al menos 12 caracteres.")
        return env, None
    f = config_dir() / "key"
    if f.exists():
        k = f.read_text(encoding="utf-8").strip()
        if len(k) >= 12:
            return k, f
        f.unlink()
    f.parent.mkdir(parents=True, exist_ok=True)
    k = secrets.token_urlsafe(24)
    fd = os.open(f, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(k + "\n")
    return k, f


HAS_FFMPEG = shutil.which("ffmpeg") is not None
JOBS: dict[str, dict] = {}
LOCK = threading.Lock()


def wipe(job_id: str) -> None:
    shutil.rmtree(TMP_ROOT / job_id, ignore_errors=True)
    with LOCK:
        JOBS.pop(job_id, None)


def janitor() -> None:
    while True:
        time.sleep(30)
        now = time.time()
        with LOCK:
            # 20 min para retirar desde que quedo listo (o fallo); mientras descarga, hasta 3 h
            old = [k for k, j in JOBS.items() if not j.get("sending") and (
                   now - j.get("done", now) > TTL or now - j["created"] > MAX_WORK)]
        for k in old:
            wipe(k)


def options(job_id: str, mode: str, quality: str, ies: list[str] | None = None) -> dict:
    def hook(d):
        with LOCK:
            j = JOBS.get(job_id)
            if not j:
                return
            if d.get("status") == "downloading":
                tot = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                if tot:
                    j["progress"] = round((d.get("downloaded_bytes") or 0) * 100 / tot, 1)
                j["status"] = "descargando"
            elif d.get("status") == "finished":
                j["status"] = "procesando"

    # YouTube: "Titulo [ID].ext" (la app usa el ID para recomendar). Otros: "Titulo {Sitio id}.ext"
    tmpl = "%(title).120B [%(id)s].%(ext)s" if not ies else "%(title).100B {%(extractor_key)s %(id).40B}.%(ext)s"
    o = {"outtmpl": str(TMP_ROOT / job_id / tmpl), "allowed_extractors": ies or ["youtube"],
         "playlist_items": "1", "noplaylist": True, "max_filesize": MAX_FILESIZE, "progress_hooks": [hook], "quiet": True,
         "no_warnings": True, "noprogress": True, "cachedir": False}
    h = {"360": 360, "480": 480, "720": 720}.get(quality, 480)
    if mode == "audio":
        if HAS_FFMPEG:
            o["format"] = "bestaudio/best"
            o["postprocessors"] = [{"key": "FFmpegExtractAudio",
                                    "preferredcodec": "mp3", "preferredquality": "160"}]
        else:
            o["format"] = "bestaudio[ext=m4a]/bestaudio"
    elif HAS_FFMPEG:
        # h264 + aac en mp4: se reproduce en iPhone y Android
        o["format"] = (f"bv*[height<={h}][vcodec^=avc1]+ba[ext=m4a]/"
                       f"b[height<={h}][ext=mp4]/bv*[height<={h}]+ba/b[height<={h}]/b")
        o["merge_output_format"] = "mp4"
    else:
        o["format"] = f"b[height<={h}][ext=mp4]/b[ext=mp4]/b"
    return o


NOISE = re.compile(r"^(?:[\d.,]+\s*[KkMm]?\s+(?:views|reactions|shares|comments|vistas|reacciones|"
                   r"veces compartido|comentarios)\s*(?:·\s*)?)+\|\s*")


def clean_title(t: str) -> str:
    """Facebook antepone '1.4K views · 340 reactions | ' al titulo: se quita."""
    return NOISE.sub("", t or "").strip()


def single(info: dict) -> dict:
    """Si el enlace trae varios videos (p. ej. una publicacion con carrusel), el primero."""
    if info.get("_type") == "playlist":
        entries = [e for e in info.get("entries") or [] if e]
        if not entries:
            raise RuntimeError("No se encontro un video o audio en ese enlace.")
        return entries[0]
    return info


def run(job_id: str, url: str, mode: str, quality: str, ies: list[str] | None = None) -> None:
    try:
        (TMP_ROOT / job_id).mkdir(parents=True)
        with yt_dlp.YoutubeDL(options(job_id, mode, quality, ies)) as ydl:
            info = single(ydl.extract_info(check_url(url), download=False))
            info["title"] = clean_title(info.get("title")) or info.get("id")
            if info.get("is_live") or info.get("live_status") in ("is_live", "is_upcoming"):
                raise RuntimeError("No se pueden guardar transmisiones en vivo")
            # tambien los servidores de donde sale el archivo
            for fm in info.get("requested_formats") or [info]:
                if fm.get("url"):
                    check_url(fm["url"])
            ydl.process_ie_result(info, download=True)
        files = [p for p in (TMP_ROOT / job_id).iterdir()
                 if p.is_file() and p.suffix not in (".part", ".ytdl")]
        if not files:
            raise RuntimeError("Demasiado pesado (mas de 1,2 GB). Prueba en audio o en 360p.")
        f = max(files, key=lambda p: p.stat().st_size)
        with LOCK:
            if job_id in JOBS:
                JOBS[job_id].update(status="listo", progress=100, done=time.time(),
                                    filename=f.name, size=f.stat().st_size)
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(TMP_ROOT / job_id, ignore_errors=True)
        with LOCK:
            if job_id in JOBS:
                JOBS[job_id].update(status="error", done=time.time(), error=friendly(exc))


APPROX = {"youtubetab": {"approximate_date": [""]}}   # "hace 3 anios" -> fecha aproximada


def search(q: str, n: int = 12, sort: str = "") -> list[dict]:
    """Busca en YouTube. Solo devuelve datos (titulo, duracion, canal, fecha); no guarda nada.
    sort=new/old: trae 40 resultados y los ordena por fecha (YouTube ya no ordena por fecha)."""
    if sort in ("new", "old"):
        n = 40
    o = {"quiet": True, "no_warnings": True, "extract_flat": True,
         "skip_download": True, "cachedir": False, "extractor_args": APPROX}
    with yt_dlp.YoutubeDL(o) as ydl:
        check_url("https://www.youtube.com/")
        info = ydl.extract_info(f"ytsearch{n}:{q}", download=False)
    out = []
    for e in (info or {}).get("entries") or []:
        if not e or not re.fullmatch(r"[\w-]{11}", e.get("id") or ""):
            continue
        out.append({"id": e["id"], "title": e.get("title") or "",
                    "duration": e.get("duration"),
                    "channel": e.get("channel") or e.get("uploader") or "",
                    "url": f"https://www.youtube.com/watch?v={e['id']}",
                    "thumb": f"https://i.ytimg.com/vi/{e['id']}/mqdefault.jpg",
                    "ts": e.get("timestamp")})
    if sort in ("new", "old"):
        dated = sorted((x for x in out if x["ts"]), key=lambda x: x["ts"], reverse=sort == "new")
        out = dated + [x for x in out if not x["ts"]]
    return out


CACHE: dict[str, tuple[float, object]] = {}
CACHE_TTL = 6 * 3600
CHAN_ID = re.compile(r"UC[\w-]{22}")


def cached(key: str):
    with LOCK:
        hit = CACHE.get(key)
    return hit[1] if hit and time.time() - hit[0] < CACHE_TTL else None


def put_cache(key: str, val) -> None:
    with LOCK:
        if len(CACHE) > 3000:
            for k in sorted(CACHE, key=lambda k: CACHE[k][0])[:1000]:
                CACHE.pop(k, None)
        CACHE[key] = (time.time(), val)


def item(e: dict) -> dict | None:
    vid = e.get("id") or ""
    if not YT_ID.fullmatch(vid) or e.get("live_status") in ("is_live", "is_upcoming"):
        return None
    return {"id": vid, "title": e.get("title") or "", "duration": e.get("duration"),
            "channel": e.get("channel") or e.get("uploader") or "",
            "url": f"https://www.youtube.com/watch?v={vid}",
            "thumb": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
            "ts": e.get("timestamp")}


LIST_ID = re.compile(r"[\w-]{12,80}")
HANDLE = re.compile(r"@[\w.\-]{3,40}")
DEAD = re.compile(r"^\[(Deleted|Private) video\]$|^\[(Video eliminado|Video privado)\]$", re.I)


def list_items(kind: str, lid: str) -> dict:
    """Playlist o canal completo (solo datos). La URL se arma aqui; nunca se usa la del usuario."""
    if kind == "playlist":
        url = f"https://www.youtube.com/playlist?list={lid}"
    else:
        url = f"https://www.youtube.com/{lid}/videos" if lid.startswith("@") else f"https://www.youtube.com/channel/{lid}/videos"
    o = {"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True,
         "cachedir": False, "playlistend": MAX_LIST, "extractor_args": APPROX}
    with yt_dlp.YoutubeDL(o) as ydl:
        info = ydl.extract_info(check_url(url), download=False)
    items = [x for x in (item(e) for e in (info or {}).get("entries") or []
                         if e and not DEAD.match(e.get("title") or "")) if x]
    return {"kind": kind, "id": lid, "title": info.get("title") or "",
            "owner": info.get("channel") or info.get("uploader") or "", "items": items}


def search_playlists(q: str) -> list[dict]:
    """Playlists que coinciden con la busqueda (filtro 'Playlists' de YouTube)."""
    o = {"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True,
         "cachedir": False, "playlistend": 24}
    with yt_dlp.YoutubeDL(o) as ydl:
        info = ydl.extract_info(check_url("https://www.youtube.com/results?search_query="
                                          + quote(q) + "&sp=EgIQAw%253D%253D"), download=False)
    out = []
    for e in (info or {}).get("entries") or []:
        lid = (parse_qs(urlparse(e.get("url") or "").query).get("list") or [e.get("id") or ""])[0] if e else ""
        if not LIST_ID.fullmatch(lid or ""):
            continue
        th = [t.get("url") for t in e.get("thumbnails") or [] if (t.get("url") or "").startswith("https://i.ytimg.com/")]
        out.append({"type": "playlist", "id": lid, "title": e.get("title") or "",
                    "channel": e.get("channel") or e.get("uploader") or "",
                    "thumb": th[-1] if th else ""})
    return out


def video_info(vid: str) -> dict:
    """Ficha para mostrar ANTES de descargar: fecha exacta, vistas y descripcion."""
    o = {"quiet": True, "no_warnings": True, "skip_download": True, "cachedir": False}
    with yt_dlp.YoutubeDL(o) as ydl:
        i = ydl.extract_info(check_url(f"https://www.youtube.com/watch?v={vid}"), download=False, process=False)
    cid = i.get("channel_id") or ""
    return {"id": vid, "title": i.get("title") or "", "channel": i.get("channel") or i.get("uploader") or "",
            "channel_id": cid if CHAN_ID.fullmatch(cid) else None,
            "upload_date": i.get("upload_date"), "views": i.get("view_count"),
            "duration": i.get("duration"), "description": (i.get("description") or "")[:1500]}


def fetch_image(url: str) -> str | None:
    """Miniatura como data: URI (la descarga el servidor, nunca el celular). Max 400 KB."""
    if not url.startswith("https://"):
        return None
    try:
        with urlopen(check_url(url), timeout=8) as r:
            ctype = (r.headers.get("Content-Type") or "").split(";")[0].strip()
            if ctype not in ("image/jpeg", "image/png", "image/webp"):
                return None
            b = r.read(400_001)
        return None if len(b) > 400_000 else f"data:{ctype};base64,{base64.b64encode(b).decode()}"
    except Exception:  # noqa: BLE001
        return None


def link_info(raw: str) -> dict:
    """Ficha de un enlace de otro sitio (Facebook, TikTok...) ANTES de descargar."""
    name, ies, url = site_link(raw)
    o = {"quiet": True, "no_warnings": True, "skip_download": True, "cachedir": False,
         "allowed_extractors": ies, "playlist_items": "1", "noplaylist": True}
    with yt_dlp.YoutubeDL(o) as ydl:
        i = single(ydl.extract_info(check_url(url), download=False))
    return {"site": name, "url": url, "title": clean_title(i.get("title"))[:200],
            "channel": i.get("uploader") or i.get("channel") or name,
            "upload_date": i.get("upload_date"), "views": i.get("view_count"),
            "duration": i.get("duration"), "description": (i.get("description") or "")[:1500],
            "thumb": fetch_image(i.get("thumbnail") or "")}


def flat(url: str, n: int) -> list[dict]:
    o = {"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True,
         "cachedir": False, "playlistend": n, "extractor_args": APPROX}
    with yt_dlp.YoutubeDL(o) as ydl:
        info = ydl.extract_info(check_url(url), download=False)
    return [e for e in (info or {}).get("entries") or [] if e]


def related(vid: str) -> dict:
    """Mix (radio) que YouTube arma para un video, sin cuenta. La 1a entrada es el propio video."""
    es = flat(f"https://www.youtube.com/watch?v={vid}&list=RD{vid}", 25)
    seed = next((e for e in es if e.get("id") == vid), None)
    return {"seed": {"channel": seed.get("channel") or seed.get("uploader") or "",
                     "channel_id": seed.get("channel_id") if CHAN_ID.fullmatch(seed.get("channel_id") or "") else None}
                    if seed else None,
            "items": [x for x in (item(e) for e in es if e.get("id") != vid) if x]}


def channel_videos(cid: str) -> list[dict]:
    return [x for x in (item(e) for e in flat(f"https://www.youtube.com/channel/{cid}/videos", 12)) if x]


def fetch_thumb(vid: str) -> bytes:
    with urlopen(check_url(f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg"), timeout=10) as r:
        return r.read(2_000_000)


def public(j: dict) -> dict:
    return {k: j.get(k) for k in ("id", "status", "progress", "filename", "size", "error", "mode")}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):  # sin registros
        pass

    def js(self, data, status=200):
        b = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def authed(self) -> bool:
        return bool(KEY) and hmac.compare_digest(
            self.headers.get("X-Key", "").encode(), KEY.encode())

    def static(self, name: str):
        p = STATIC / name
        b = p.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(p.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            return self.static("index.html")
        if path in ("/sw.js", "/manifest.webmanifest", "/icon.svg", "/icon-192.png",
                    "/icon-512.png", "/apple-touch-icon.png"):
            return self.static(path[1:])
        if not path.startswith("/api/"):
            return self.js({"error": "no encontrado"}, 404)
        if not self.authed():
            return self.js({"error": "clave incorrecta"}, 401)
        if path == "/api/ping":
            return self.js({"ok": True})
        qs = parse_qs(urlparse(self.path).query)
        if path == "/api/search":
            q = (qs.get("q") or [""])[0].strip()[:120]
            if not q:
                return self.js([])
            sort = (qs.get("sort") or [""])[0]
            try:
                return self.js(search(q, min(int((qs.get("n") or ["12"])[0]), 24), sort))
            except Exception as exc:  # noqa: BLE001
                msg = re.sub(r"\x1b\[[0-9;]*m", "", str(exc)).split("; please report")[0]
                return self.js({"error": msg.replace("ERROR: ", "")[:300]}, 502)
        if path in ("/api/related", "/api/channel", "/api/info", "/api/playlist", "/api/artist", "/api/playlists"):
            arg = (qs.get("id") or qs.get("q") or [""])[0].strip()
            ok = {"/api/channel": lambda a: CHAN_ID.fullmatch(a),
                  "/api/playlist": lambda a: LIST_ID.fullmatch(a),
                  "/api/artist": lambda a: CHAN_ID.fullmatch(a) or HANDLE.fullmatch(a),
                  "/api/playlists": lambda a: 0 < len(a) <= 120}.get(path, lambda a: YT_ID.fullmatch(a))(arg)
            if not ok:
                return self.js({"error": "id invalido"}, 400)
            key = path + ":" + arg
            hit = cached(key)
            if hit is not None:
                return self.js(hit)
            try:
                val = {"/api/related": related, "/api/channel": channel_videos, "/api/info": video_info,
                       "/api/playlist": lambda a: list_items("playlist", a),
                       "/api/artist": lambda a: list_items("channel", a),
                       "/api/playlists": search_playlists}[path](arg)
                put_cache(key, val)
            except Exception:  # noqa: BLE001  sin Mix / canal privado / fallo puntual: vacio y sin cachear
                if path in ("/api/info", "/api/playlist", "/api/artist"):
                    return self.js({"error": "No se pudo leer en YouTube (privada o no existe)"}, 502)
                val = {"seed": None, "items": []} if path == "/api/related" else []
            return self.js(val)
        if path == "/api/link":
            raw = (qs.get("url") or [""])[0].strip()
            s = site_link(raw)
            if not s:
                return self.js({"error": f"Ese enlace no es de un sitio compatible: {SITE_NAMES}."}, 400)
            hit = cached("/api/link:" + s[2])
            if hit is not None:
                return self.js(hit)
            try:
                val = link_info(raw)
            except Exception as exc:  # noqa: BLE001
                return self.js({"error": friendly(exc)}, 502)
            put_cache("/api/link:" + s[2], val)
            return self.js(val)
        if path == "/api/thumb":
            vid = (qs.get("id") or [""])[0]
            if not re.fullmatch(r"[\w-]{11}", vid):
                return self.js({"error": "id invalido"}, 400)
            try:
                b = fetch_thumb(vid)
            except Exception:  # noqa: BLE001
                return self.js({"error": "sin miniatura"}, 502)
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(b)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return self.wfile.write(b)
        m = re.fullmatch(r"/api/jobs/([0-9a-f]{16})(/file)?", path)
        if not m:
            return self.js({"error": "no encontrado"}, 404)
        job_id = m.group(1)
        with LOCK:
            j = JOBS.get(job_id)
            if j and m.group(2) and j["status"] == "listo" and not j.get("sending"):
                j["sending"] = True
                sending = True
            else:
                sending = False
        if not j:
            return self.js({"error": "no encontrado"}, 404)
        if not m.group(2):
            return self.js(public(j))
        if not sending:
            return self.js({"error": "no disponible"}, 409)
        f = TMP_ROOT / job_id / j["filename"]
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(j["size"]))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            with f.open("rb") as fh:
                while chunk := fh.read(256 * 1024):
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            wipe(job_id)  # se borra siempre, haya llegado completo o no

    def do_POST(self):
        if urlparse(self.path).path != "/api/jobs":
            return self.js({"error": "no encontrado"}, 404)
        if not self.authed():
            return self.js({"error": "clave incorrecta"}, 401)
        n = int(self.headers.get("Content-Length") or 0)
        try:
            d = json.loads(self.rfile.read(n)) if 0 < n < 5000 else {}
        except json.JSONDecodeError:
            d = {}
        raw = str(d.get("id") or d.get("url") or "")
        vid, ies = youtube_id(raw), None
        if vid:
            # YouTube: nunca se usa el enlace que manda el usuario; se arma uno desde el ID
            url = f"https://www.youtube.com/watch?v={vid}"
        elif s := site_link(raw):
            _, ies, url = s
        else:
            return self.js({"error": f"Ese enlace no es de un sitio compatible: {SITE_NAMES}."}, 400)
        mode = "audio" if d.get("mode") == "audio" else "video"
        with LOCK:
            active = sum(1 for j in JOBS.values() if j["status"] not in ("listo", "error"))
            if active >= MAX_ACTIVE:
                return self.js({"error": "Espera a que termine la descarga actual", "retry": 10}, 429)
        with LOCK:
            job_id = uuid.uuid4().hex[:16]
            JOBS[job_id] = {"id": job_id, "status": "en cola", "progress": 0,
                            "mode": mode, "created": time.time()}
        threading.Thread(target=run, args=(job_id, url, mode, str(d.get("quality", "480")), ies),
                         daemon=True).start()
        self.js(public(JOBS[job_id]), 201)


def lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as so:
            so.connect(("192.0.2.1", 9))   # no envia nada; solo elige la interfaz
            return so.getsockname()[0]
    except OSError:
        return None


def main():
    global KEY
    ap = argparse.ArgumentParser(description="Offline Entertainment: servidor personal")
    ap.add_argument("--port", type=int, default=int(os.environ.get("OFFLINE_PORT", 8765)))
    ap.add_argument("--host", default=os.environ.get("OFFLINE_HOST", "127.0.0.1"),
                    help="127.0.0.1 = solo este equipo (por defecto); 0.0.0.0 = tu red de casa")
    a = ap.parse_args()
    KEY, key_file = load_key()
    shutil.rmtree(TMP_ROOT, ignore_errors=True)
    TMP_ROOT.mkdir(parents=True)
    os.chmod(TMP_ROOT, 0o700)
    threading.Thread(target=janitor, daemon=True).start()
    srv = ThreadingHTTPServer((a.host, a.port), H)
    host = "127.0.0.1" if a.host in ("0.0.0.0", "::", "127.0.0.1") else a.host
    print(f"Offline Entertainment listo  (ffmpeg: {'si' if HAS_FFMPEG else 'NO, instalalo para audio mp3'})")
    if sys.stdout.isatty():
        # el #k= no llega al servidor: el navegador lo guarda y lo borra de la barra
        print(f"  Abre en este equipo:  http://{host}:{a.port}/#k={KEY}")
        if a.host in ("0.0.0.0", "::") and lan_ip():
            print(f"  En tu red de casa:    http://{lan_ip()}:{a.port}   (clave: {KEY})")
    else:
        print(f"  Direccion: http://{host}:{a.port}")
        print(f"  Clave guardada en {key_file}" if key_file else "  Clave: la de OFFLINE_KEY")
    sys.stdout.flush()
    srv.serve_forever()


if __name__ == "__main__":
    main()
