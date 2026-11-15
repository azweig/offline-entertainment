"""Pruebas minimas: autenticacion, clave automatica y bloqueo de direcciones privadas.
No se conectan a internet."""
import json, os, socket, stat, sys, tempfile, threading, unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

KEY = "clave-de-prueba-123456"  # gitleaks:allow (clave falsa solo para pruebas)


class Auth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.KEY = KEY
        server.TMP_ROOT.mkdir(parents=True, exist_ok=True)
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), server.H)
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def setUp(self):
        server.FAILS.clear()

    def call(self, path, key=None, body=None):
        h = {"X-Key": key} if key is not None else {}
        data = None
        if body is not None:
            data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
        try:
            with urlopen(Request(self.base + path, data=data, headers=h), timeout=5) as r:
                return r.status, json.loads(r.read() or b"null")
        except HTTPError as e:
            with e:
                return e.code, json.loads(e.read() or b"null")

    def test_ping_sin_clave_401(self):
        self.assertEqual(self.call("/api/ping")[0], 401)

    def test_ping_clave_mala_401(self):
        self.assertEqual(self.call("/api/ping", "otra-clave-cualquiera")[0], 401)

    def test_ping_con_clave_200(self):
        self.assertEqual(self.call("/api/ping", KEY), (200, {"ok": True}))

    def test_todas_las_api_piden_clave(self):
        for p in ("/api/search?q=x", "/api/info?id=dQw4w9WgXcQ", "/api/jobs/0123456789abcdef"):
            self.assertEqual(self.call(p)[0], 401, p)
        self.assertEqual(self.call("/api/jobs", body={"id": "dQw4w9WgXcQ"})[0], 401)

    def test_pagina_publica(self):
        with urlopen(self.base + "/", timeout=5) as r:
            self.assertEqual(r.status, 200)

    def test_solo_sitios_de_la_lista(self):
        for url in ("http://127.0.0.1:22/", "http://169.254.169.254/latest/meta-data/",
                    "https://example.com/watch?v=dQw4w9WgXcQ", "file:///etc/passwd",
                    "https://facebook.com.ejemplo.com/v", "https://www.facebook.com:8443/v"):
            self.assertEqual(self.call("/api/jobs", KEY, {"url": url})[0], 400, url)
            self.assertEqual(self.call("/api/link?url=" + quote(url), KEY)[0], 400, url)

    def test_sin_clave_definida_nadie_entra(self):
        with mock.patch.object(server, "KEY", ""):
            self.assertEqual(self.call("/api/ping", "")[0], 401)


class Sites(unittest.TestCase):
    def test_aceptados_y_limpios(self):
        ok = {"https://www.facebook.com/watch/?v=274175099429670#x": "https://www.facebook.com/watch/?v=274175099429670",
              "http://m.facebook.com/reel/1195289147628387": "https://m.facebook.com/reel/1195289147628387",
              "https://www.tiktok.com/@user/video/7059698374567611694": None,
              "https://x.com/user/status/719944021058060289": None,
              "https://soundcloud.com/artista/cancion": None,
              "https://artista.bandcamp.com/track/cancion": None}
        for raw, want in ok.items():
            s = server.site_link(raw)
            self.assertIsNotNone(s, raw)
            self.assertTrue(s[2].startswith("https://"), raw)
            if want:
                self.assertEqual(s[2], want)

    def test_rechazados(self):
        for raw in ("https://facebook.com.ejemplo.com/video", "https://notfacebook.com/v",
                    "https://user:pass@www.facebook.com/v", "https://www.facebook.com:8443/v",
                    "ftp://www.facebook.com/v", "https://ejemplo.com/video.mp4", "javascript:alert(1)",
                    "https://192.168.1.1/", "https://www.reddit.com/r/x/comments/1/"):
            self.assertIsNone(server.site_link(raw), raw)

    def test_titulo_facebook_limpio(self):
        self.assertEqual(server.clean_title("119 reactions · 1.4K shares | Asif Nawab"), "Asif Nawab")
        self.assertEqual(server.clean_title("9.9K views · 340 reactions | When your mom"), "When your mom")
        self.assertEqual(server.clean_title("Canción | Artista"), "Canción | Artista")

    def test_solo_extractores_del_sitio(self):
        _, ies, _ = server.site_link("https://www.instagram.com/reel/abc/")
        self.assertEqual(server.options("x", "audio", "480", ies)["allowed_extractors"], ies)
        self.assertNotIn("generic", " ".join(ies).lower())
        self.assertEqual(server.options("x", "audio", "480")["allowed_extractors"], ["youtube"])


class Key(unittest.TestCase):
    def test_genera_y_reusa_clave_600(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ, {"OFFLINE_CONFIG_DIR": d}, clear=False):
            os.environ.pop("OFFLINE_KEY", None)
            k1, f = server.load_key()
            self.assertGreaterEqual(len(k1), 24)
            if os.name != "nt":
                self.assertEqual(stat.S_IMODE(f.stat().st_mode), 0o600)
            k2, _ = server.load_key()
            self.assertEqual(k1, k2)

    def test_variable_tiene_prioridad(self):
        with mock.patch.dict(os.environ, {"OFFLINE_KEY": KEY}):
            self.assertEqual(server.load_key(), (KEY, None))

    def test_clave_corta_rechazada(self):
        with mock.patch.dict(os.environ, {"OFFLINE_KEY": "corta"}):
            with self.assertRaises(SystemExit):
                server.load_key()


def fake_dns(ip):
    fam = socket.AF_INET6 if ":" in ip else socket.AF_INET
    return lambda *a, **k: [(fam, socket.SOCK_STREAM, 6, "", (ip, 443))]


class PrivateAddresses(unittest.TestCase):
    BLOCKED = ["127.0.0.1", "127.8.8.8", "10.0.0.5", "172.16.0.1", "172.31.255.255",
               "192.168.1.10", "169.254.169.254", "100.64.0.1", "100.127.255.254", "0.0.0.0",
               "::1", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:192.168.1.1", "::ffff:127.0.0.1"]
    ALLOWED = ["142.250.79.14", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2607:f8b0:4002::64"]

    def test_bloqueadas(self):
        for ip in self.BLOCKED:
            self.assertTrue(server.blocked_ip(ip), ip)

    def test_publicas(self):
        for ip in self.ALLOWED:
            self.assertFalse(server.blocked_ip(ip), ip)

    def test_resuelve_antes_de_conectar(self):
        # un nombre "inocente" que resuelve a una IP interna se rechaza
        for ip in ("192.168.0.1", "::1", "100.100.100.100"):
            with mock.patch("socket.getaddrinfo", fake_dns(ip)):
                with self.assertRaises(ValueError):
                    server.check_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        with mock.patch("socket.getaddrinfo", fake_dns("142.250.79.14")):
            self.assertTrue(server.check_url("https://www.youtube.com/"))

    def test_descarga_no_arranca_si_dns_apunta_adentro(self):
        jid = "abcdef0123456789"
        server.TMP_ROOT.mkdir(parents=True, exist_ok=True)
        server.JOBS[jid] = {"id": jid, "status": "en cola", "created": 0}
        with mock.patch("socket.getaddrinfo", fake_dns("10.1.2.3")), \
             mock.patch.object(server.yt_dlp.YoutubeDL, "extract_info") as ex:
            server.run(jid, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "audio", "480")
            ex.assert_not_called()
        self.assertEqual(server.JOBS[jid]["status"], "error")
        self.assertIn("privada", server.JOBS[jid]["error"])
        server.JOBS.pop(jid, None)


class Hardening(Auth):   # reusa el servidor de prueba de Auth
    """Arreglos de la revision de seguridad (docs/security.md)."""

    def raw(self, data: bytes) -> bytes:
        host, port = self.srv.server_address
        with socket.create_connection((host, port), timeout=5) as c:
            c.sendall(data)
            c.shutdown(socket.SHUT_WR)
            return c.recv(4096)

    def test_barra_invertida_no_engana_al_filtro(self):
        for raw in ("https://localhost\\x.bandcamp.com/track/a", "https://127.0.0.1\\.bandcamp.com/track/a",
                    "https://evil%2ecom.bandcamp.com/track/a", "https://a b.bandcamp.com/track/a",
                    "https://xn--.bandcamp.com/track/a", "https://-a.bandcamp.com/track/a"):
            self.assertIsNone(server.site_link(raw), raw)
        self.assertIsNotNone(server.site_link("https://artista-1.bandcamp.com/track/a"))

    def test_guardia_de_conexion(self):
        for ip in ("127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "64:ff9b::a00:1", "2002:a00:1::1", "fec0::1"):
            fam = socket.AF_INET6 if ":" in ip else socket.AF_INET
            with socket.socket(fam, socket.SOCK_STREAM) as so, self.assertRaises(ConnectionRefusedError):
                server.guarded_connect(so, (ip, 80))

    def test_cuerpo_roto_400_sin_cortar(self):
        for body in (b"[1,2]", b"\xff\xfe", b"no es json"):
            r = self.raw(b"POST /api/jobs HTTP/1.1\r\nHost: x\r\nX-Key: " + KEY.encode() +
                         b"\r\nContent-Length: " + str(len(body)).encode() + b"\r\n\r\n" + body)
            self.assertIn(b" 400 ", r.split(b"\r\n")[0], body)
        r = self.raw(b"POST /api/jobs HTTP/1.1\r\nHost: x\r\nX-Key: " + KEY.encode() + b"\r\nContent-Length: abc\r\n\r\n")
        self.assertIn(b" 400 ", r.split(b"\r\n")[0])

    def test_muchas_claves_malas_429(self):
        for _ in range(server.FAIL_LIMIT[0]):
            self.assertEqual(self.call("/api/ping", "mala-mala-mala")[0], 401)
        self.assertEqual(self.call("/api/ping", "mala-mala-mala")[0], 429)
        self.assertEqual(self.call("/api/ping", KEY)[0], 429)   # bloquea a esa IP un rato, aun con la clave
        server.FAILS.clear()
        self.assertEqual(self.call("/api/ping", KEY)[0], 200)

    def test_cabeceras_de_seguridad_y_csp(self):
        with urlopen(self.base + "/", timeout=5) as r:
            h = r.headers
            body = r.read().decode()
        self.assertEqual(h["X-Content-Type-Options"], "nosniff")
        self.assertEqual(h["X-Frame-Options"], "DENY")
        self.assertIn("frame-ancestors 'none'", h["Content-Security-Policy"])
        script_src = h["Content-Security-Policy"].split("script-src")[1].split(";")[0]
        self.assertIn("'sha256-", script_src)
        self.assertNotIn("unsafe", script_src)
        self.assertNotIn("onerror=", body)   # la CSP no permite manejadores en linea
        self.assertNotIn("http", script_src)    # ningun script de otro sitio
        import re
        for src in re.findall(r'<script src="([^"]+)"', body):   # los scripts propios existen y son publicos
            with urlopen(f"{self.base}/{src}", timeout=5) as r:
                self.assertEqual(r.status, 200, src)
        self.assertEqual(self.call("/api/ping", KEY)[0], 200)

    def test_n_fuera_de_rango_no_llega_a_ytdlp(self):
        with mock.patch.object(server, "search", return_value=[]) as s:
            for n in ("0", "-5", "999", "abc"):
                self.assertEqual(self.call(f"/api/search?q=x&n={n}", KEY)[0], 200)
            self.assertEqual([c.args[1] for c in s.call_args_list], [1, 1, 24, 12])

    def test_limite_de_descargas_cuenta_hilos(self):
        with mock.patch.object(server, "ACTIVE", server.MAX_ACTIVE):
            r = self.call("/api/jobs", KEY, {"id": "dQw4w9WgXcQ"})
        self.assertEqual(r[0], 429)

    def test_corta_si_pasa_el_tope_de_tamano(self):
        jid = "fedcba9876543210"
        server.JOBS[jid] = {"id": jid, "status": "en cola", "created": __import__("time").time()}
        hook = server.options(jid, "video", "480")["progress_hooks"][0]
        hook({"status": "downloading", "filename": "v.mp4", "downloaded_bytes": server.MAX_FILESIZE // 2 + 1})
        with self.assertRaises(RuntimeError):
            hook({"status": "downloading", "filename": "a.m4a", "downloaded_bytes": server.MAX_FILESIZE // 2 + 1})
        server.JOBS.pop(jid)
        with self.assertRaises(RuntimeError):   # descartada por el janitor: la descarga se corta
            hook({"status": "downloading", "filename": "v.mp4", "downloaded_bytes": 1})

    def test_todas_las_busquedas_solo_con_youtube(self):
        import inspect
        for fn in (server.search, server.list_items, server.search_playlists, server.video_info, server.flat):
            self.assertIn("allowed_extractors", inspect.getsource(fn), fn.__name__)


class Resume(Auth):   # reusa el servidor de prueba de Auth
    """Descargas que se pueden retomar: Range, el archivo queda si se corta y se borra al entregarlo entero."""

    def job(self, data: bytes) -> str:
        import secrets, time
        jid = secrets.token_hex(8)
        (server.TMP_ROOT / jid).mkdir(parents=True)
        (server.TMP_ROOT / jid / "v.mp4").write_bytes(data)
        server.JOBS[jid] = {"id": jid, "status": "listo", "created": time.time(), "done": time.time(),
                            "filename": "v.mp4", "size": len(data)}
        return jid

    def get(self, jid, rng=None):
        h = {"X-Key": KEY, **({"Range": rng} if rng else {})}
        try:
            with urlopen(Request(f"{self.base}/api/jobs/{jid}/file", headers=h), timeout=5) as r:
                return r.status, dict(r.headers), r.read()
        except HTTPError as e:
            with e:
                return e.code, dict(e.headers), e.read()

    def wait_gone(self, jid):
        import time
        for _ in range(50):
            if jid not in server.JOBS:
                return True
            time.sleep(0.02)
        return False

    def test_retoma_desde_el_byte_pedido(self):
        data = os.urandom(700_000)
        jid = self.job(data)
        st, h, body = self.get(jid, "bytes=300000-")
        self.assertEqual(st, 206)
        self.assertEqual(h["Content-Range"], f"bytes 300000-{len(data) - 1}/{len(data)}")
        self.assertEqual(body, data[300000:])
        self.assertTrue(self.wait_gone(jid))   # entregado entero: se borra

    def test_corte_deja_el_archivo_para_retomar(self):
        import time
        data = os.urandom(4_000_000)
        jid = self.job(data)
        host, port = self.srv.server_address
        with socket.create_connection((host, port), timeout=5) as c:
            c.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4096)
            c.sendall(f"GET /api/jobs/{jid}/file HTTP/1.1\r\nHost: x\r\nX-Key: {KEY}\r\n\r\n".encode())
            c.recv(1024)
            c.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, __import__("struct").pack("ii", 1, 0))
        for _ in range(100):
            if not server.JOBS[jid].get("sending"):
                break
            time.sleep(0.05)
        self.assertFalse(server.JOBS[jid].get("sending"))
        self.assertTrue((server.TMP_ROOT / jid / "v.mp4").exists())
        st, _, body = self.get(jid, "bytes=1000-")
        self.assertEqual((st, body), (206, data[1000:]))
        self.assertTrue(self.wait_gone(jid))

    def test_rango_fuera_de_tamano_416(self):
        jid = self.job(b"x" * 10)
        st, h, _ = self.get(jid, "bytes=10-")
        self.assertEqual((st, h["Content-Range"]), (416, "bytes */10"))
        server.wipe(jid)

    def test_sin_range_200_completo(self):
        data = os.urandom(1000)
        jid = self.job(data)
        st, h, body = self.get(jid)
        self.assertEqual((st, body, h["Accept-Ranges"]), (200, data, "bytes"))


EMBED = ('<html><script id="__NEXT_DATA__" type="application/json">'
         '{"props":{"pageProps":{"state":{"data":{"entity":{"name":"Mi lista","subtitle":"Ana",'
         '"coverArt":{"sources":[{"url":"https://evil.example/x.jpg"}]},"trackList":['
         '{"uri":"spotify:track:3h5T5JypYU7huFiVYhv1dr","title":"BbY WOW","subtitle":"KAROL G,\\u00a0Judeline","duration":225834},'
         '{"uri":"spotify:track:<script>","title":"mala","subtitle":"x","duration":1}]}}}}}}</script></html>')


class Spotify(unittest.TestCase):
    def test_enlaces(self):
        for raw, want in [("https://open.spotify.com/playlist/37i9dQZF1DX4UtSsGT1Sbe?si=1", ("playlist", "37i9dQZF1DX4UtSsGT1Sbe")),
                          ("https://open.spotify.com/intl-es/album/4aawyAB9vmqN3uQ7FjRGTy", ("album", "4aawyAB9vmqN3uQ7FjRGTy")),
                          ("spotify:track:3h5T5JypYU7huFiVYhv1dr", ("track", "3h5T5JypYU7huFiVYhv1dr"))]:
            m = server.SP_LINK.fullmatch(raw)
            self.assertEqual((m.group(1) or m.group(2), m.group(3)), want)
        for raw in ("https://open.spotify.com.evil.com/playlist/37i9dQZF1DX4UtSsGT1Sbe",
                    "https://open.spotify.com/user/37i9dQZF1DX4UtSsGT1Sbe", "https://open.spotify.com/playlist/corto"):
            self.assertIsNone(server.SP_LINK.fullmatch(raw), raw)

    def test_lee_solo_titulos_validos_y_tapa_de_spotify(self):
        class R:
            def __init__(self, b): self.b = b
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self, n): return self.b
        with mock.patch.object(server, "check_url", lambda u: u), \
             mock.patch.object(server.OPENER, "open", lambda *a, **k: R(EMBED.encode())), \
             mock.patch.object(server, "fetch_image") as fi:
            d = server.spotify_list("playlist", "37i9dQZF1DX4UtSsGT1Sbe")
        self.assertEqual(d["items"], [{"sp": "3h5T5JypYU7huFiVYhv1dr", "title": "BbY WOW",
                                       "artists": "KAROL G, Judeline", "duration": 226}])
        fi.assert_not_called()   # la portada solo se pide si viene de i.scdn.co
        self.assertIsNone(d["cover"])

    def test_elige_la_cancion_por_titulo(self):
        es = {"entries": [{"id": "aaaaaaaaaaa", "title": "Otra cosa"}, {"id": "bbbbbbbbbbb", "title": "Take on Me (2017)"}]}
        ydl = mock.MagicMock()
        ydl.__enter__.return_value.extract_info.return_value = es
        with mock.patch.object(server, "check_url", lambda u: u), mock.patch.object(server.yt_dlp, "YoutubeDL", return_value=ydl):
            self.assertEqual(server.find_song("Take On Me", "a-ha"), "bbbbbbbbbbb")


class Translations(unittest.TestCase):
    """Cada idioma tiene todas las claves (texto en espanol) con los mismos {n}."""

    def test_diccionario_completo(self):
        import re
        js = (Path(server.STATIC) / "i18n-dict.js").read_text(encoding="utf-8")
        body = js[js.index("{"):js.rindex("}") + 1]
        d = json.loads(re.sub(r"^(\w\w): ", r'"\1": ', body, flags=re.M))
        self.assertEqual(set(d), {"en", "pt", "zh", "ru", "ja"})
        ref = set(d["en"])
        self.assertGreater(len(ref), 150)
        for lang, m in d.items():
            self.assertEqual(set(m), ref, lang)
            for k, v in m.items():
                self.assertTrue(v.strip(), (lang, k))
                self.assertEqual(sorted(re.findall(r"\{\d\}", k)), sorted(re.findall(r"\{\d\}", v)), (lang, k))


if __name__ == "__main__":
    unittest.main()
