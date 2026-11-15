# Self-hosting guide

Everything you need to run Offline Entertainment for yourself: on your computer, on an always-on home
server, in Docker, and reachable from your phone over HTTPS.

- [Requirements](#requirements)
- [Option 1: your computer (quickest)](#option-1-your-computer-quickest)
- [Option 2: Docker](#option-2-docker)
- [Option 3: always on, with systemd](#option-3-always-on-with-systemd)
- [Reaching it from your phone](#reaching-it-from-your-phone)
- [Behind a reverse proxy](#behind-a-reverse-proxy)
- [Installing the app on the phone](#installing-the-app-on-the-phone)
- [Keys: view, change, rotate](#keys-view-change-rotate)
- [Updating](#updating)
- [Hardening checklist](#hardening-checklist)

## Requirements

| | Minimum | Notes |
|---|---|---|
| Python | 3.11 | Current yt-dlp requires it |
| ffmpeg | any recent | Needed for MP3 and for joining video + audio into MP4 |
| Deno | 2.x | yt-dlp uses it to solve YouTube's JavaScript challenges |
| RAM / CPU | 512 MB, 1 core | ffmpeg conversion is the heaviest part |
| Disk | ~2.5 GB free in the temp dir | Two jobs at once, 1.2 GB max each; nothing is kept afterwards |
| Network | a **home** connection | YouTube usually blocks datacenter/VPS IPs |

Install the tools:

| OS | Command |
|---|---|
| macOS | `brew install python ffmpeg deno` |
| Debian / Ubuntu | `sudo apt install python3 python3-venv ffmpeg` and `curl -fsSL https://deno.land/install.sh \| sh` |
| Windows | `winget install Python.Python.3.13 Gyan.FFmpeg DenoLand.Deno` |

## Option 1: your computer (quickest)

```bash
git clone https://github.com/azweig/offline-entertainment
cd offline-entertainment
make run            # or ./start.sh   ·   Windows: start.bat
```

Open the address it prints: `http://127.0.0.1:8765/#k=…`. The `#k=` part logs you in on that browser.
Run `make` to see every shortcut (`make key`, `make update`, `make test`, …).

## Option 2: Docker

ffmpeg and Deno are included. The container runs as a non-root user (uid 10001) with every Linux
capability dropped, `no-new-privileges`, memory and process limits, and writes no logs. The key lives
in a named volume (`config`), so permissions are right on Linux without any `chmod`.

```bash
make docker-up      # = docker compose up -d --build
make key            # prints your key (stored in the "config" volume)
```

The port is published only on the host's `127.0.0.1`. To reach it from your home network, change
`"127.0.0.1:8765:8765"` to `"8765:8765"` in `docker-compose.yml` (prefer Tailscale, below).

To use your own key, uncomment `OFFLINE_KEY` in `docker-compose.yml`, or better, put it in a
`.env` file next to it (already git-ignored) and reference it as `OFFLINE_KEY: ${OFFLINE_KEY}`.

## Option 3: always on, with systemd

For a home server or a Raspberry Pi. Run it as your normal user, not root:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/offline-entertainment.service <<'EOF'
[Unit]
Description=Offline Entertainment
After=network-online.target

[Service]
WorkingDirectory=%h/offline-entertainment
ExecStart=%h/offline-entertainment/.venv/bin/python server.py --host 127.0.0.1 --port 8765
Restart=on-failure
# No access logs are written by the app; keep journald quiet too
StandardOutput=null
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=%h/.config/offline-entertainment

[Install]
WantedBy=default.target
EOF
make setup                                   # creates .venv
systemctl --user daemon-reload
systemctl --user enable --now offline-entertainment
loginctl enable-linger "$USER"               # keep it running after you log out
```

`PrivateTmp=yes` gives the service its own `/tmp`, where jobs are prepared. Read your key with
`make key`.

## Reaching it from your phone

| Way | Offline mode on the phone | Effort | Exposure |
|---|---|---|---|
| **Tailscale `serve`** (recommended) | ✅ (real HTTPS) | Low | Only your devices |
| Home Wi-Fi, `--host 0.0.0.0` | ❌ (plain http) | None | Everyone on your Wi-Fi can reach the login |
| Your own domain + reverse proxy | ✅ | Medium | Internet-facing: see hardening |

**Why HTTPS matters.** Phones only run service workers (the part that opens the app with no
connection) and keep storage reliably on secure origins. Over plain `http://192.168.x.x` you can
search and save, but the app will not open in airplane mode.

### Tailscale (recommended)

1. Install [Tailscale](https://tailscale.com/download) on the server and the phone, same account.
2. Keep the server on `127.0.0.1` and run: `tailscale serve --bg 8765`
3. On the phone open `https://<machine>.<tailnet>.ts.net`, enter your key, install to home screen.

Use `serve`, **never `funnel`**: `funnel` publishes the server to the whole internet.

## Behind a reverse proxy

Keep `server.py` on `127.0.0.1` and let only the proxy reach it. Large files are streamed, so turn
off response buffering and raise timeouts.

**Caddy** (`Caddyfile`, automatic HTTPS):

```caddy
media.example.com {
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options nosniff
        Referrer-Policy no-referrer
        X-Frame-Options DENY
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
    }
    reverse_proxy 127.0.0.1:8765 {
        flush_interval -1
        transport http {
            response_header_timeout 10m
        }
    }
    log {
        output discard
    }
}
```

**nginx**:

```nginx
server {
    listen 443 ssl http2;
    server_name media.example.com;
    # ssl_certificate / ssl_certificate_key ...

    access_log off;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header X-Frame-Options DENY always;

    client_max_body_size 16k;
    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

Internet-facing means anyone can try keys. The key is 32 random characters (≈190 bits), so guessing
is not practical, but consider adding rate limiting or an allowlist at the proxy anyway, and
remember the project is meant for personal use, not public instances.

## Installing the app on the phone

- **iPhone (Safari):** Share → *Add to Home Screen*. This also protects your downloads from Safari's
  automatic clean-up of website data.
- **Android (Chrome):** menu ⋮ → *Install app*.
- Enter the key once. Then try it: turn on airplane mode and open the app from the home screen.

## Keys: view, change, rotate

| Task | How |
|---|---|
| Show the key and the one-tap link | `make key` |
| Use your own key | set `OFFLINE_KEY` (12+ characters) and restart |
| Rotate the generated key | delete `~/.config/offline-entertainment/key` (Docker: `docker compose exec offline-entertainment rm /config/key`) and restart; enter the new key on each phone |

The key is never logged. When the server runs as a service (stdout is not a terminal) it prints only
the key file's path, not the key.

## Updating

```bash
git pull
make update          # yt-dlp: do this first whenever a site stops working
# Docker: docker compose build --pull --no-cache && docker compose up -d
```

## Hardening checklist

- [ ] Bound to `127.0.0.1` (default) and reached through Tailscale `serve` or a reverse proxy.
- [ ] HTTPS on the phone (needed for offline mode anyway).
- [ ] Running as a normal user (Docker: uid 10001), never root.
- [ ] Key generated by the server, or `OFFLINE_KEY` with 20+ random characters.
- [ ] No access logs at the proxy (`log { output discard }` / `access_log off`).
- [ ] yt-dlp updated regularly (`make update`, or merge Dependabot PRs).
- [ ] Not offered to other people as a service (see the usage notice in the README).
