# HTTP API reference

The phone app is the only intended client, but the API is small, stable and easy to script.
A machine-readable version is in [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1); you can open it in
[Swagger Editor](https://editor.swagger.io/) or any OpenAPI viewer.

- Base URL: wherever the server runs, e.g. `http://127.0.0.1:8765`.
- **Authentication:** every `/api/*` request needs the header `X-Key: <your key>`. Without it, or with
  a wrong key, the answer is `401 {"error": "clave incorrecta"}`. The comparison is constant-time.
- Responses are JSON (`application/json; charset=utf-8`) with `Cache-Control: no-store`, except the
  file and thumbnail downloads.
- Error bodies are always `{"error": "<message>"}`. Messages are in Spanish because they are shown to
  the user as they are.

## Endpoints at a glance

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ping` | Check key and connectivity |
| GET | `/api/search` | Search YouTube videos |
| GET | `/api/playlists` | Search YouTube playlists |
| GET | `/api/info` | Details of one YouTube video |
| GET | `/api/related` | YouTube Mix for a video ("For you") |
| GET | `/api/channel` | Latest videos of a channel |
| GET | `/api/playlist` | Every item of a playlist (max 200) |
| GET | `/api/artist` | Every video of a channel or @handle (max 200) |
| GET | `/api/link` | Details of a link from another supported site |
| GET | `/api/spotify` | Song list of a public Spotify playlist, album, artist or track |
| GET | `/api/skins` | Search the optional classic-skin catalog (`q`, `cat`, `o`) |
| GET | `/api/skins/cats` | Catalog categories with counts |
| GET | `/api/skins/{md5}.png` / `.wsz` | A catalog skin's screenshot or file (fetched from the museum on first use) |
| GET | `/api/thumb` | A YouTube thumbnail, fetched through the server |
| POST | `/api/jobs` | Start preparing a file |
| GET | `/api/jobs/{id}` | Job progress |
| GET | `/api/jobs/{id}/file` | Download the file (resumable with `Range`) |

Static, unauthenticated: `/`, `/index.html`, `/sw.js`, `/manifest.webmanifest`, `/icon.svg`,
`/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png`. Anything else is `404`.

## Common objects

**Video** (search, lists, related):

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "…",
  "duration": 213,
  "channel": "…",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "thumb": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  "ts": 1256453463
}
```

`duration` (seconds) and `ts` (Unix time, approximate for search results) can be `null`.

**Job**:

```json
{ "id": "3f2a9c0d1e4b5a67", "status": "descargando", "progress": 42.5,
  "filename": null, "size": null, "error": null, "mode": "video" }
```

`status` is one of `en cola`, `descargando`, `procesando`, `listo`, `error`.

## Endpoints

### `GET /api/ping`
`200 {"ok": true}`. Used by the app to tell "server reachable" from "phone has signal".

### `GET /api/search?q=&n=&sort=`
| Param | Rules |
|---|---|
| `q` | Required, trimmed, max 120 chars. Empty → `[]` |
| `n` | 1–24, default 12 |
| `sort` | `new` or `old` fetch 40 results and sort them by date; anything else = relevance |

`200 [Video, …]` · `502 {"error"}` if YouTube fails.

### `GET /api/playlists?q=`
`q`: 1–120 chars. `200 [{"type": "playlist", "id", "title", "channel", "thumb"}]`.

### `GET /api/info?id=`
`id`: 11-char YouTube ID. `200 {"id", "title", "channel", "channel_id", "upload_date": "YYYYMMDD",
"views", "duration", "description" (max 1500 chars)}` · `502` if private or missing.

### `GET /api/related?id=`
`200 {"seed": {"channel", "channel_id"} | null, "items": [Video]}`. Empty `items` when YouTube has no Mix.

### `GET /api/channel?id=`
`id`: `UC` + 22 chars. `200 [Video]` (latest 12).

### `GET /api/playlist?id=` · `GET /api/artist?id=`
`playlist`: list ID, 12–80 chars of `[A-Za-z0-9_-]`. `artist`: channel ID (`UC…`) or `@handle`
(3–40 chars). `200 {"kind", "id", "title", "owner", "items": [Video]}` (max 200, deleted/private
entries removed) · `502` if it can't be read.

### `GET /api/spotify?kind=&id=`
`kind`: `playlist` · `album` · `artist` · `track`; `id`: the 22-character Spotify id. Reads Spotify's public
embed page (no account, no key). Only titles and artists are returned; no audio comes from Spotify.
`200 {"kind", "id", "title", "owner", "cover": "data:image/…"|null, "items": [{"sp", "title", "artists", "duration"}]}`
(max 100 for playlists, 10 for artists) · `400` bad kind/id · `404` empty or private · `502` Spotify did not answer. Cached 6 h.

To save a song from the list, start a job with `{"song": {"title", "artists"}, "mode": "audio"}` instead of
`id`/`url`: the job finds the song on YouTube Music (then YouTube search) and saves that video's audio.

### Skins (optional catalog)
Built with `make skins` into `skins.db` in the config dir; without it these return empty lists / `404`.
- `GET /api/skins?q=&cat=&o=` → `{"total", "items": [{"md5", "name", "cats": [..]}]}`, 60 per page, featured first.
- `GET /api/skins/cats` → `{"total", "cats": [{"name", "count"}]}`.
- `GET /api/skins/{md5}.wsz` · `.png` → the file (`application/zip` / `image/png`). Only md5s present in the
  catalog are served (adult skins are never in it). The server downloads from the Winamp Skin Museum's
  public storage on first use, checks the `.wsz` md5, caches it on disk (500 MB cap, least recently
  used removed first) and answers with `Cache-Control: immutable`. `404` not in catalog · `502` museum
  unavailable.

### `GET /api/link?url=`
`url`: a link from a [supported site](../README.md#supported-sites), max 500 chars.

```json
{ "site": "TikTok", "url": "https://www.tiktok.com/@user/video/123…",
  "title": "…", "channel": "…", "upload_date": "20261101", "views": 1200,
  "duration": 31, "description": "…", "thumb": "data:image/jpeg;base64,…" }
```

`thumb` is a `data:` URI (max 400 KB) or `null`; it is downloaded by the server so the phone never
contacts the site. `400` if the site is not in the list · `502 {"error"}` with a friendly message
("login required", "blocked in your country", …).

### `GET /api/thumb?id=`
`200 image/jpeg` (max 2 MB) · `400` bad ID · `502` not available.

### `POST /api/jobs`
Body (JSON, under 5000 bytes):

```json
{ "id": "dQw4w9WgXcQ", "mode": "audio", "quality": "480" }
```

| Field | Rules |
|---|---|
| `id` or `url` | A YouTube ID or link, or a link from a supported site |
| `mode` | `audio` (MP3 160 kbps; M4A without ffmpeg) or `video` (default; H.264/AAC MP4) |
| `quality` | `360`, `480` (default) or `720`; max height for video |

`201 Job` · `400` unsupported link · `401` · `429 {"error", "retry": 10}` when 2 jobs are already
running (retry after the given seconds).

### `GET /api/jobs/{id}`
`id`: 16 lowercase hex chars. `200 Job` · `404` unknown or already delivered/expired.

### `GET /api/jobs/{id}/file`
`200 application/octet-stream` with `Content-Length` and `Accept-Ranges: bytes`.

- **Resumable:** send `Range: bytes=N-` to get the rest from byte `N` → `206` with
  `Content-Range: bytes N-(size-1)/size`. `N` at or past the end → `416` with `Content-Range: bytes */size`.
  Only the open-ended form `bytes=N-` is supported.
- **Deleted once delivered:** when a response reaches the last byte, the file and the job are deleted.
  If the transfer is interrupted, the file stays for another 60 minutes (`TTL`) so the client can resume.
- **One transfer at a time:** while a transfer is in progress, other requests get
  `409 {"error": "no disponible"}`; retry once it has ended. A connection that stops reading is
  dropped after 60 s. Unknown, delivered or expired jobs → `404`.

## Example: save a song with curl

```bash
KEY=$(cat ~/.config/offline-entertainment/key)
API=http://127.0.0.1:8765/api
JOB=$(curl -s -H "X-Key: $KEY" -H 'Content-Type: application/json' \
      -d '{"id":"jNQXAC9IVRw","mode":"audio"}' $API/jobs | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
until curl -s -H "X-Key: $KEY" $API/jobs/$JOB | grep -q '"listo"'; do sleep 2; done
curl -s -H "X-Key: $KEY" -o song.mp3 $API/jobs/$JOB/file
```
