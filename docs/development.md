# Development guide

## Set up

```bash
git clone https://github.com/azweig/offline-entertainment
cd offline-entertainment
make setup        # .venv + yt-dlp + ruff + pip-audit
make run          # http://127.0.0.1:8765/#k=…
```

Requirements: Python 3.11+, ffmpeg and Deno (see [self-hosting.md](self-hosting.md#requirements)).

## Everyday commands

| Command | What it does |
|---|---|
| `make run` | Start on `127.0.0.1:8765` |
| `make run-lan` | Start on `0.0.0.0` to test from a phone on your Wi-Fi |
| `make test` | Unit tests (`unittest`, no network needed) |
| `make lint` | `ruff` with error, bug and security (bandit) rules |
| `make smoke` | Starts the real server in a temp config dir and checks key 600 / 401 / 200 / 404 |
| `make check` | All of the above: exactly what CI runs |
| `make key` | Print your key and one-tap link |

## Repository layout

```
server.py                 the whole server (see docs/architecture.md §4)
static/index.html         the whole app: UI, storage, queue, player
static/sw.js              service worker (offline app shell)
static/i18n.js, i18n-dict.js  languages (see Translations below)
static/retro.js           the optional 90s-style music player and its 20 themes
static/manifest.webmanifest, icon.svg, *.png
tests/test_server.py      auth, key file, link guard, DNS blocking, job start
scripts/smoke.sh          real start-up check used by CI and `make smoke`
start.sh, start.bat       one-command start for end users
Dockerfile, docker-compose.yml
docs/                     architecture, API (+ OpenAPI), security, self-hosting, ADRs
.github/                  CI, CodeQL, Dependabot, issue and PR templates
```

## Code conventions

- **No new dependencies** unless there is no reasonable alternative. The server is stdlib + yt-dlp.
- **Every outbound connection goes through `check_url()`**, and every URL passed to yt-dlp is built on
  the server from a validated ID or from `site_link()`. Never pass user input to yt-dlp as-is.
- **Remote text is untrusted.** In the frontend, render titles, channels and descriptions only through
  `esc()` (in template strings) or `textContent`.
- **No logs, no history.** Don't add access logs, analytics or anything that records what was saved.
- **Destructive actions ask first.** Deleting a file or a playlist shows a confirmation with
  *Cancel* and a red *Delete* button.
- Comments and user-facing strings in the code are in Spanish; docs are in English and Spanish.
- When you change anything served by the service worker, bump `CACHE` in `static/sw.js`
  (`offline-entertainment-vN`) so phones pick up the new version.

## Tests

`tests/test_server.py` starts the real `H` handler on a random port and mocks only DNS
(`socket.getaddrinfo`) and yt-dlp where needed, so tests never touch the internet. Add a test for:

- any new endpoint (including that it returns `401` without the key);
- any change to `site_link()`, `youtube_id()`, `check_url()` or `blocked_ip()`;
- any new limit.

## Adding a site

1. Find the exact extractor names: `.venv/bin/yt-dlp --list-extractors | grep -i <site>`.
2. Add a tuple to `SITES` in `server.py`: `("Name", ("domain.com", "short.link"), ("ExactExtractor",))`.
   **Never** `generic`.
3. Test with public content while logged out: `/api/link?url=…` and a real save in audio and video.
4. Add tests for accepted and rejected URLs of that site.
5. Add the site to the tables in `README.md` and `README.es.md`, and to `CHANGELOG.md`.

## Translations

The app speaks Spanish, English, Portuguese, Chinese, Russian and Japanese.

- **Spanish is the source.** Code and server messages are written in Spanish, as before.
- `static/i18n.js` translates what reaches the screen: text nodes, `placeholder` / `aria-label` /
  `title`, `alert` / `confirm` / `prompt` and the page title. A `MutationObserver` does it as the app
  renders, so no string in `index.html` has to be wrapped. Song and video titles (`.ti`) and anything
  under `[data-noi18n]` are left alone.
- `static/i18n-dict.js` holds the translations: `{lang: {"texto en español": "translation"}}`.
  `{0}`, `{1}` mark parts that change (`"Guardando… {0}%"`), and a line like
  `"Spotify · Pitbull · 18 canciones"` is translated piece by piece around ` · ` and ` — `.
- The language comes from the browser, can be changed with the 🌐 button and is kept in
  `localStorage` (`vlang`). Dates use `toLocaleDateString` in that language.

**Adding or changing text:** write it in Spanish as usual, then add the same Spanish string as a key
to every language in `i18n-dict.js`. `make test` fails if a language is missing a key or a
placeholder. Anything without a translation simply shows in Spanish, so check the screen in another
language before releasing.

## Releasing

1. Update `CHANGELOG.md` (move *Unreleased* to the new version) and `version` in `pyproject.toml`.
2. `make check`, then commit.
3. `git tag -a vX.Y.Z -m "vX.Y.Z" && git push --follow-tags`
4. `gh release create vX.Y.Z --notes-from-tag` (or paste the changelog section).

Versioning follows [SemVer](https://semver.org/): a change to the HTTP API or to where the phone
stores data is a major version.
