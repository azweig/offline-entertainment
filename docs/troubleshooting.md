# Troubleshooting and FAQ

## Something stopped working

| Symptom | Likely cause | Fix |
|---|---|---|
| Search or saving from YouTube fails, "Sign in to confirm you're not a bot" | The server's IP is a datacenter/VPS, or YouTube changed | Run it on a home connection; `make update` |
| A site that used to work now fails | The site changed | `make update` (updates yt-dlp), restart |
| "Ese contenido pide iniciar sesión o es privado" | The post is private, age-restricted or needs login | Only public content is supported (by design) |
| "El sitio no deja ver esa publicación desde tu país" | Region block | Not supported (by design) |
| "Ese enlace no es de un sitio compatible" | The domain is not in the list | See the supported sites table |
| "Ese enlace no es de un video o canción suelto" | You pasted a profile, album or list | Paste the link of one video or song |
| "Enlace bloqueado: apunta a una dirección privada o local" | The hostname resolves to a private IP (or your DNS does that) | Expected protection; check your DNS if it happens with normal sites |
| "Demasiado pesado (más de 1,2 GB)" | File larger than the limit | Save it as audio or at 360p |
| "Espera a que termine la descarga actual" | 2 jobs already running | The app retries on its own |
| YouTube works but is slow to start | Deno is missing | Install Deno and restart |
| Audio saves as M4A, not MP3 / video won't play on iPhone | ffmpeg is missing | Install ffmpeg and restart |

## The phone

**The app doesn't open in airplane mode.** It must be served over HTTPS (Tailscale `serve` or a
reverse proxy) and opened once online so the service worker can install. Plain
`http://192.168.x.x` can't work offline: browsers only allow service workers on secure origins.

**My downloads disappeared (iPhone).** Safari clears website data for sites you haven't used in a
while. Install the app to the home screen: installed apps are not cleaned up that way.

**It asks for the key again.** The browser's site data was cleared, or the key changed on the server.
Enter it again (`make key` shows it).

**"No space" or a download stops at "Guardando…".** The phone's browser ran out of its storage quota.
Delete some items in *My downloads* or save in audio / 360p.

**Is it the old version?** The app shows the cached version first and updates in the background:
close it and open it again.

## The server

**Where is my key?** `make key`. Files: `~/.config/offline-entertainment/key` (Windows:
`%APPDATA%\offline-entertainment\key`, Docker: `/config/key` inside the `config` volume).

**Port 8765 is busy.** `make run PORT=8790` or `python server.py --port 8790`.

**Does the server keep my files?** No. Each file is deleted right after it is sent, files nobody picks
up are deleted after 20 minutes, and the private temp folder is removed when the server stops.

**Can I see what was downloaded?** No. There are no logs or history by design.

## FAQ

**Can I use my YouTube/Facebook account to get private or members-only content?** No, and it won't be
added. See [ADR 0005](adr/0005-no-accounts-cookies-or-evasion.md).

**Can I host it for friends?** Please don't. It is a personal tool; running it for others has legal
implications and is out of scope. Each person can run their own.

**Does it work on a VPS?** It runs, but YouTube usually blocks datacenter IPs. Other sites may work.

**Can several phones use the same server?** Yes, with the same key. Each phone keeps its own library.
