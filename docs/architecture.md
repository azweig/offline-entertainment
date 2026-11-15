# Architecture

This document describes how Offline Entertainment is built: the parts, how they talk to each other,
where data lives and why it was designed this way. All diagrams are [Mermaid](https://mermaid.js.org/)
and render directly on GitHub.

- [1. Goals and constraints](#1-goals-and-constraints)
- [2. System context](#2-system-context-c4-level-1)
- [3. Containers](#3-containers-c4-level-2)
- [4. Server components](#4-server-components-c4-level-3)
- [5. Static structure (UML class diagrams)](#5-static-structure-uml-class-diagrams)
- [6. Key flows (UML sequence diagrams)](#6-key-flows-uml-sequence-diagrams)
- [7. Job lifecycle (UML state machine)](#7-job-lifecycle-uml-state-machine)
- [8. Data: what is stored where](#8-data-what-is-stored-where)
- [9. Deployment views](#9-deployment-views)
- [10. Concurrency, limits and resource use](#10-concurrency-limits-and-resource-use)
- [11. Frontend internals](#11-frontend-internals)
- [12. Design decisions](#12-design-decisions)

---

## 1. Goals and constraints

| Goal | How the design meets it |
|---|---|
| Play saved videos and music with **no connection at all** | Files live in the phone's browser storage (OPFS/IndexedDB); a service worker serves the app shell offline. |
| **Self-hosted**, no central service | One process on the user's own computer or home server. No accounts, no telemetry, no third-party calls besides the content sites. |
| **Nothing kept on the server** | Files are prepared in a temp folder, sent once and deleted. No database, no history, no access logs. |
| **Safe to expose to a phone** | Mandatory key, `127.0.0.1` by default, link allowlist, DNS check against private networks before every connection. |
| **Easy to install and audit** | One Python file (stdlib + yt-dlp), one HTML file, no build step, no framework. |

**Non-goals** (rejected on purpose): account cookies or logins, proxies, browser impersonation, getting
around site blocks, public or multi-user instances.

## 2. System context (C4 level 1)

```mermaid
flowchart TB
    user(["👤 You<br/>(phone owner)"])
    subgraph boundary["Your devices"]
        phone["📱 Offline Entertainment PWA<br/>in the phone's browser"]
        server["🖥️ Offline Entertainment server<br/>server.py on your computer / home server"]
    end
    sites["🌐 Content sites<br/>YouTube, Facebook, Instagram, TikTok, X,<br/>Vimeo, SoundCloud, Dailymotion, Twitch,<br/>Bandcamp, Internet Archive"]
    user -- "searches, saves, plays" --> phone
    phone -- "HTTPS (or LAN http) + X-Key header" --> server
    server -- "HTTPS via yt-dlp (allowlisted extractors only)" --> sites
```

The phone **never talks to the content sites for media**: search results, info and files come through
your server. (Thumbnails in search results are loaded by the browser from `i.ytimg.com`; saved
thumbnails are fetched through the server.)

## 3. Containers (C4 level 2)

```mermaid
flowchart LR
    subgraph Phone["📱 Phone browser"]
        UI["index.html<br/>UI · queue · player<br/>(vanilla JS, no build)"]
        SW["sw.js<br/>service worker<br/>app-shell cache"]
        OPFS[("OPFS / IndexedDB<br/>media files + thumbnails")]
        LS[("localStorage<br/>key · playlists · order · queue")]
        UI --- OPFS
        UI --- LS
        SW -. "serves the app offline" .- UI
    end
    subgraph Host["🖥️ Your computer"]
        PY["server.py<br/>ThreadingHTTPServer<br/>(Python stdlib)"]
        YT["yt-dlp library<br/>+ Deno (YouTube JS)<br/>+ ffmpeg"]
        TMP[("temp dir (0700)<br/>one folder per job")]
        KEYF[("key file (0600)<br/>~/.config/offline-entertainment/key")]
        PY --> YT --> TMP --> PY
        PY --- KEYF
    end
    UI <== "JSON API + file stream" ==> PY
    YT <== "HTTPS" ==> NET(("Content sites"))
```

| Container | Technology | Responsibility |
|---|---|---|
| `static/index.html` | HTML + CSS + vanilla JS | Search, info sheet, download queue, library, music player, offline mode |
| `static/sw.js` | Service Worker | Stale-while-revalidate cache of the app shell; never caches `/api/` |
| Browser storage | OPFS (IndexedDB fallback), localStorage | The user's library and preferences. The only persistent copy of media. |
| `server.py` | Python 3.11+ stdlib `http.server` | Auth, input validation, link guard, job orchestration, one-time file delivery |
| yt-dlp + ffmpeg + Deno | Libraries / binaries | Extraction, download, remux to H.264 MP4 or convert to MP3 |

## 4. Server components (C4 level 3)

`server.py` is a single module, organised in clearly separated groups of functions:

```mermaid
flowchart TB
    subgraph HTTP["HTTP layer"]
        H["H(BaseHTTPRequestHandler)<br/>do_GET · do_POST · authed · js · static"]
    end
    subgraph Guard["Link guard"]
        YID["youtube_id()<br/>link → 11-char ID"]
        SL["site_link()<br/>allowlist + URL rebuild"]
        CU["check_url()<br/>DNS resolve + block private IPs"]
        BI["blocked_ip()"]
        CU --> BI
    end
    subgraph Catalog["Catalog (read-only metadata)"]
        S["search()"]
        SP["search_playlists()"]
        LI["list_items()"]
        VI["video_info()"]
        RE["related() · channel_videos() · flat()"]
        LK["link_info() · fetch_image()"]
        FT["fetch_thumb()"]
    end
    subgraph Jobs["Jobs (downloads)"]
        RUN["run()"]
        OPT["options()<br/>format · extractor allowlist · size cap"]
        WIPE["wipe() · janitor()"]
    end
    subgraph State["In-memory state (LOCK)"]
        JOBS[("JOBS")]
        CACHE[("CACHE<br/>6 h, max 3000")]
    end
    subgraph Boot["Start-up"]
        MAIN["main()"]
        LK2["load_key() · config_dir()"]
    end
    H --> YID & SL
    H --> Catalog
    H --> RUN
    H --> JOBS & CACHE
    Catalog --> CU
    RUN --> OPT
    RUN --> CU
    RUN --> JOBS
    WIPE --> JOBS
    MAIN --> LK2
    MAIN --> H
```

**Rule enforced across the code:** every outbound connection (`extract_info`, media format URLs,
`urlopen` for thumbnails) is preceded by `check_url()`, and every URL handed to yt-dlp is **built by the
server** from a validated ID or a rebuilt allowlisted link, never taken verbatim from the request.

## 5. Static structure (UML class diagrams)

### 5.1 Server

The server is procedural; the diagram groups functions into logical classes (stereotype `«module»`)
so the responsibilities and dependencies are easy to see.

```mermaid
classDiagram
    direction LR
    class H {
        «BaseHTTPRequestHandler»
        +do_GET()
        +do_POST()
        -authed() bool
        -js(data, status)
        -static(name)
        -log_message() «no-op: no logs»
    }
    class LinkGuard {
        «module»
        +SITES: list
        +BLOCKED_NETS: list
        +youtube_id(raw) str|None
        +site_link(raw) tuple|None
        +check_url(url) str
        +blocked_ip(addr) bool
    }
    class KeyStore {
        «module»
        +config_dir() Path
        +load_key() (str, Path|None)
    }
    class Catalog {
        «module»
        +search(q, n, sort) list
        +search_playlists(q) list
        +list_items(kind, id) dict
        +video_info(id) dict
        +related(id) dict
        +channel_videos(id) list
        +link_info(raw) dict
        +fetch_image(url) str|None
        +fetch_thumb(id) bytes
    }
    class JobRunner {
        «module»
        +JOBS: dict
        +MAX_ACTIVE = 2
        +MAX_FILESIZE = 1.2 GB
        +TTL = 20 min
        +run(job_id, url, mode, quality, ies)
        +options(job_id, mode, quality, ies) dict
        +wipe(job_id)
        +janitor()
        +single(info) dict
        +clean_title(t) str
    }
    class Cache {
        «module»
        +CACHE: dict
        +cached(key)
        +put_cache(key, val)
    }
    class Job {
        «dict»
        id: str (16 hex)
        status: en cola|descargando|procesando|listo|error
        progress: float
        mode: audio|video
        created: float
        done: float
        filename: str
        size: int
        error: str
        sending: bool
    }
    class YoutubeDL {
        «yt-dlp»
        extract_info()
        process_ie_result()
    }
    H ..> KeyStore : KEY (set at start-up)
    H ..> LinkGuard : validates input
    H ..> Catalog : metadata endpoints
    H ..> Cache
    H ..> JobRunner : POST /api/jobs
    JobRunner "1" o-- "0..*" Job
    JobRunner ..> LinkGuard : check_url before each connection
    Catalog ..> LinkGuard : check_url before each connection
    JobRunner ..> YoutubeDL
    Catalog ..> YoutubeDL
```

### 5.2 Frontend

```mermaid
classDiagram
    direction LR
    class App {
        «index.html script»
        key: str
        view: str
        online: bool
        library: File[]
        go(view, query)
        start()
        recheck()
    }
    class Api {
        api(path, opts) Response
        getJSON(path)
        search(q, n, sort)
        ping(ms) on|off|key
    }
    class Store {
        «OPFS, IndexedDB fallback»
        mode: opfs|idb
        init()
        save(name, response, onProgress)
        list() File[]
        blob(name) Blob
        remove(name)
    }
    class Queue {
        enqueue(v, mode, quality)
        downloadOne(v, mode, quality, set)
        addBatch(title, items)
        runBatch()
    }
    class Player {
        play(name)
        playAudio(name)
        buildQueue(start, scope)
        step(d)
        setShuffle(v)
        setRepeat(v)
    }
    class Library {
        renderLibrary()
        savePlaylist(key, title, items)
        confirmRemoveItem(name)
        confirmRemovePl(key, title)
    }
    class ServiceWorker {
        «sw.js»
        CACHE: offline-entertainment-vN
        install()
        activate()
        fetch() stale-while-revalidate
    }
    App --> Api
    App --> Library
    Queue --> Api
    Queue --> Store
    Library --> Store
    Player --> Store
    App ..> ServiceWorker : registers
```

## 6. Key flows (UML sequence diagrams)

### 6.1 First start and key hand-off

```mermaid
sequenceDiagram
    autonumber
    actor U as You
    participant T as Terminal
    participant S as server.py
    participant B as Browser
    U->>T: ./start.sh  (or make run)
    T->>S: python server.py
    S->>S: load_key(): OFFLINE_KEY, else key file, else secrets.token_urlsafe(24)
    S->>S: write key file with O_CREAT|O_EXCL, mode 0600
    S->>S: wipe and recreate temp dir (0700)
    S-->>T: "Open: http://127.0.0.1:8765/#k=<key>" (only when stdout is a TTY)
    U->>B: open the link
    Note over B,S: the #fragment is never sent to the server
    B->>S: GET /
    S-->>B: index.html
    B->>B: read #k=, save to localStorage, history.replaceState() removes it from the address bar
    B->>S: GET /api/ping  (X-Key)
    S->>S: hmac.compare_digest (constant time)
    S-->>B: 200 {"ok": true}
```

### 6.2 Saving a video (job)

```mermaid
sequenceDiagram
    autonumber
    participant P as Phone app
    participant H as HTTP handler
    participant G as Link guard
    participant J as Job thread (run)
    participant Y as yt-dlp / ffmpeg
    participant X as Content site
    P->>H: POST /api/jobs {id|url, mode, quality} + X-Key
    H->>H: authed()? body < 5000 bytes?
    H->>G: youtube_id(raw) or site_link(raw)
    G-->>H: rebuilt URL + allowed extractors (or 400)
    H->>H: active jobs < 2? (else 429 + retry)
    H->>J: start thread with job_id (uuid4, 16 hex)
    H-->>P: 201 {id, status: "en cola"}
    J->>G: check_url(page URL): resolve DNS, reject private IPs
    J->>Y: extract_info(download=False)
    Y->>X: HTTPS
    J->>J: reject live streams, keep first item of a carousel
    J->>G: check_url() for each media format URL
    J->>Y: process_ie_result(download=True)  (max 1.2 GB)
    Y->>X: HTTPS (media)
    Y->>Y: ffmpeg: H.264/AAC MP4 or MP3
    J->>J: status = listo, filename, size
    loop every second
        P->>H: GET /api/jobs/{id}
        H-->>P: {status, progress}
    end
    P->>H: GET /api/jobs/{id}/file
    H->>H: mark "sending" under LOCK (only one download ever)
    H-->>P: application/octet-stream (streamed in 256 KB chunks)
    H->>H: wipe(job_id) in finally: deleted even if the transfer broke
    P->>P: Store.save(): OPFS write, verify length, then thumbnail
```

### 6.3 Link from another site (preview before saving)

```mermaid
sequenceDiagram
    autonumber
    participant P as Phone app
    participant H as HTTP handler
    participant G as Link guard
    participant Y as yt-dlp
    participant X as Site (e.g. TikTok)
    P->>H: GET /api/link?url=... + X-Key
    H->>G: site_link(url)
    alt not in SITES
        G-->>H: None
        H-->>P: 400 "not a supported site"
    else allowlisted
        G-->>H: (site, [exact extractor names], https://host/path?query)
        H->>H: cached? return it
        H->>G: check_url(rebuilt URL)
        H->>Y: extract_info(allowed_extractors = that site only)
        Y->>X: HTTPS
        H->>G: check_url(thumbnail URL)
        H->>X: GET thumbnail (≤ 400 KB, image/* only)
        H-->>P: {site, title, channel, date, views, description, thumb as data: URI}
    end
```

### 6.4 Opening the app with no connection

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant SW as Service worker
    participant A as App
    participant ST as OPFS / IndexedDB
    B->>SW: navigate to the app
    SW-->>B: cached app shell (instant), revalidates in background if online
    A->>ST: Store.init() + list()
    A->>A: ping(): real request to /api/ping, 2.5 s timeout
    alt server reachable
        A->>A: online mode: search + library + resume queued batch
    else offline / server off
        A->>A: open straight into "My downloads"
        A->>ST: blob(name) → object URL → <video>/<audio>
    end
```

## 7. Job lifecycle (UML state machine)

```mermaid
stateDiagram-v2
    [*] --> en_cola: POST /api/jobs (201)
    en_cola --> descargando: yt-dlp progress hook
    descargando --> procesando: download finished (ffmpeg)
    en_cola --> error: validation / DNS block / live stream
    descargando --> error: site error, > 1.2 GB
    procesando --> listo: file ready
    procesando --> error
    listo --> enviando: GET /file (first and only time)
    enviando --> [*]: wipe() in finally (complete or not)
    listo --> [*]: janitor, not picked up in 20 min
    error --> [*]: janitor, 20 min after failure
    descargando --> [*]: janitor, still working after 3 h
```

States are the Spanish strings the API returns: `en cola` (queued), `descargando` (downloading),
`procesando` (processing), `listo` (ready), `error`. `enviando` is the internal `sending` flag.

## 8. Data: what is stored where

| Data | Where | Lifetime | Who can read it |
|---|---|---|---|
| Key | Server: `OFFLINE_KEY` or key file (0600). Phone: `localStorage['vk']` | Until you change it | You |
| Media being prepared | Server temp dir `offline-entertainment-XXXX/<job>` (new per run, 0700) | Until delivered, max 20 min after ready, max 3 h working; removed when the server stops | Server process |
| Job metadata | Server memory (`JOBS`) | Same as above | Server process |
| Search / list / info results | Server memory (`CACHE`) | 6 h, max 3000 entries, lost on restart | Server process |
| Saved media + thumbnails | Phone: OPFS (`navigator.storage.getDirectory()`) or IndexedDB `offline-entertainment/files` | Until you delete it (persistent storage requested) | Only that browser profile |
| Playlists, song order, shuffle/repeat, pending batch | Phone: `localStorage` (`vpls`, `morder`, `mshuf`, `mrep`, `vbatch`) | Until you clear it | Only that browser profile |
| Access logs | **None** (`log_message` is a no-op; Docker `logging: none`) | — | — |

File names carry the source ID so the app can recommend and de-duplicate:
`Title [YouTubeID].mp4` for YouTube and `Title {Extractor id}.mp4` for other sites.

## 9. Deployment views

### 9.1 Local, this computer only (default)

```mermaid
flowchart LR
    subgraph PC["Your computer"]
        B["Browser"] -- "http://127.0.0.1:8765" --> S["server.py<br/>bind 127.0.0.1"]
    end
    S -- HTTPS --> I(("Internet"))
```

### 9.2 Phone over HTTPS with Tailscale (recommended)

```mermaid
flowchart LR
    subgraph Phone
        PWA["PWA (installed to home screen)"]
    end
    subgraph PC["Home computer / server"]
        TS["tailscale serve :443<br/>(TLS cert for *.ts.net)"] --> S["server.py<br/>bind 127.0.0.1:8765"]
    end
    PWA -- "WireGuard tailnet<br/>https://machine.tailnet.ts.net" --> TS
    S -- HTTPS --> I(("Content sites"))
```

HTTPS matters: browsers only allow service workers (offline mode) and reliable persistent storage on
secure origins. `tailscale serve` keeps it private to your tailnet; `tailscale funnel` would publish it
to the internet and must not be used.

### 9.3 Docker

```mermaid
flowchart LR
    subgraph Host["Host"]
        P["127.0.0.1:8765"] --> C
        subgraph C["container (user app, uid 10001)"]
            S["server.py<br/>bind 0.0.0.0:8765 inside"]
            F["ffmpeg + Deno + yt-dlp"]
        end
        V[("volume config → /config<br/>key file")] --- C
    end
```

The container listens on all interfaces **inside** its network namespace, but `docker-compose.yml`
publishes the port only on the host's `127.0.0.1`. Logging driver is `none`; all capabilities are
dropped, `no-new-privileges` is set, and memory (1 GB) and processes (256) are capped.

### 9.4 Behind a reverse proxy

See [self-hosting.md](self-hosting.md#behind-a-reverse-proxy) for Caddy and nginx examples with the
recommended security headers. Keep the server bound to `127.0.0.1` and let only the proxy reach it.

## 10. Concurrency, limits and resource use

| Limit | Value | Where |
|---|---|---|
| Concurrent downloads | 2 (`MAX_ACTIVE`), extra requests get `429` with `retry: 10` | `do_POST` |
| File size | 1.2 GB (`MAX_FILESIZE`, enforced by yt-dlp) | `options()` |
| Job working time | 3 h (`MAX_WORK`) | `janitor()` |
| Pick-up window | 20 min after ready/failed (`TTL`) | `janitor()` |
| Playlist / channel size | 200 items (`MAX_LIST`) | `list_items()` |
| Search results | 24 (40 when sorting by date) | `do_GET`, `search()` |
| Request body | < 5000 bytes, JSON | `do_POST` |
| Thumbnail via `/api/link` | 400 KB, `image/jpeg|png|webp` only | `fetch_image()` |
| Metadata cache | 6 h, 3000 entries (evicts the oldest 1000) | `put_cache()` |

Threads: `ThreadingHTTPServer` gives one thread per connection; each job runs in its own daemon
thread; one janitor thread runs every 30 s. Shared state (`JOBS`, `CACHE`) is only touched under
`LOCK`.

## 11. Frontend internals

- **No build, no framework.** One `<script>` in `index.html`. Every string that comes from a site
  (titles, channels, descriptions) is rendered through `esc()` or `textContent`.
- **Storage.** `Store` probes OPFS with a real write (`createWritable`); if that fails it falls back to
  IndexedDB. Downloads stream straight to disk and are verified against `Content-Length`; partial
  files are removed.
- **Connectivity.** `navigator.onLine` only says whether there is Wi-Fi/data, so the app pings its own
  server (`/api/ping`, 2.5 s timeout) on start, on `online` and when the tab becomes visible.
- **Queue.** Single downloads run one after another (`enqueue`). Playlists and artists use a batch
  (`addBatch`/`runBatch`) persisted in `localStorage`, so it resumes after the app is closed, waits
  when the server answers `429` and skips items that fail.
- **Player.** Continuous play, shuffle, repeat and custom order; Media Session API for lock-screen
  controls; broken files are skipped.
- **Service worker.** Stale-while-revalidate for the app shell, never for `/api/`; does not cache
  redirects or opaque responses (captive portals). Bump `CACHE` in `sw.js` when the shell changes.

## 12. Design decisions

Recorded as short Architecture Decision Records in [`docs/adr/`](adr/):

| ADR | Decision |
|---|---|
| [0001](adr/0001-single-file-stdlib-server.md) | One Python file using only the standard library (plus yt-dlp) |
| [0002](adr/0002-library-lives-on-the-phone.md) | The library lives on the phone; the server is a pass-through |
| [0003](adr/0003-extractor-allowlist-and-dns-guard.md) | Closed site allowlist, exact extractors and a DNS guard against private networks |
| [0004](adr/0004-mandatory-key-in-url-fragment.md) | A key is always required; it is handed over in the URL fragment |
| [0005](adr/0005-no-accounts-cookies-or-evasion.md) | No accounts, cookies, proxies or block evasion |
