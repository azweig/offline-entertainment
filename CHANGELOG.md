# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.4.0] - 2026-11-15

### Added
- The 90s player now uses the classic 275×116 desktop-player layout and can load classic Winamp 2
  skins (`.wsz`) chosen by the user: a small zip reader (`DecompressionStream`) and the skin's BMP
  sprites, `TEXT.BMP` font, `VISCOLOR.TXT` and `PLEDIT.TXT` colors. Skins are stored only on the device
  (hidden file in the app's storage) and can be deleted with confirmation. None are bundled.
- The app reloads itself when a new version is installed (unless something is downloading or playing).

### Fixed
- Retro player parts no longer inherit the app's button styles.

## [1.3.0] - 2026-11-15

### Added
- Six languages: Spanish, English, Portuguese, Chinese, Russian and Japanese. Picked from the browser,
  changeable with the 🌐 button and remembered per device. `static/i18n.js` translates what reaches the
  screen (including server messages, dialogs and accessibility labels) from `static/i18n-dict.js`;
  dates follow the language and the home rows search YouTube in it. A test checks that every language
  has every string and the same placeholders.
- "Listen like it's the 90s": an optional retro music player (LCD time, scrolling title, spectrum bars,
  beveled buttons, retro playlist window) with 20 original color themes, remembered per device. It
  drives the same `<audio>` element, so lock-screen playback keeps working; the spectrum is real on
  computers and animated on phones (where the audio is never routed through Web Audio).

### Changed
- CSP `script-src` also allows `'self'` for the new `i18n.js`, `i18n-dict.js` and `retro.js`
  (still no inline scripts other than the hashed one); they are part of the offline app shell.

## [1.2.0] - 2026-11-15

### Added
- Spotify: paste a public playlist, album, artist or song link to see its songs and save them all
  (or one) as audio. Only the song list is read, from Spotify's public embed page (no account, no key);
  each song is found and saved from YouTube Music. Saved lists appear as playlists in *My downloads*,
  with "download the missing ones". `GET /api/spotify` and `{"song": {...}}` jobs.

### Fixed
- Thumbnails of links from other sites (Facebook, TikTok, SoundCloud…) were not saved with the media:
  the CSP blocked reading the `data:` image. `connect-src` now allows `data:`.

## [1.1.0] - 2026-11-15

### Added
- Resumable downloads: `GET /api/jobs/{id}/file` accepts `Range: bytes=N-` (`206`/`416`). The phone
  saves confirmed 8 MB parts and, after switching apps or losing signal, asks only for the rest.
- Playlist batches prepare the next song on the server while the current one is being saved.
- Screen Wake Lock while downloading, so the phone does not freeze the app by itself.
- [ADR 0006](docs/adr/0006-resumable-downloads.md).

### Changed
- A file is deleted once it has arrived complete; an interrupted transfer keeps it for up to
  60 minutes (`TTL` 20 → 60 min). Stalled transfers are dropped after 60 s.

## [1.0.0] - 2026-11-15

### Added
- Documentation set: architecture with C4 and UML diagrams, HTTP API reference and OpenAPI 3.1 spec,
  security review and threat model, self-hosting guide, development guide, troubleshooting, ADRs.
- `Makefile` with `run`, `test`, `lint`, `smoke`, `check`, `docker-up`, `key`, `update`.
- `scripts/smoke.sh`: real start-up check (key file 600, 401 without key, 200 with key, 404 on traversal).
- CI: ruff lint (incl. security rules), unit tests on Python 3.11 and 3.13, smoke test, pip-audit,
  gitleaks secret scan, Docker build and start check; CodeQL for Python and JavaScript; Dependabot.
- Issue forms, PR template, CODEOWNERS, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.editorconfig`,
  `.dockerignore`, `pyproject.toml`.

## [0.1.0] - 2026-11-14

### Added
- First public release: YouTube search (videos and playlists), info sheet, "For you", whole
  playlists and artists in audio, links from 10 more sites (Facebook, Instagram, TikTok, X, Vimeo,
  SoundCloud, Dailymotion, Twitch, Bandcamp, Internet Archive).
- Offline-first PWA: OPFS/IndexedDB storage, service worker, music player with shuffle, repeat,
  custom order and lock-screen controls, playlists, delete with confirmation.
- Mandatory auto-generated key (file mode 600), `#k=` one-tap login, listens on 127.0.0.1 by default.
- Link guard: site allowlist, exact yt-dlp extractors (never `generic`), URL rebuilt on the server,
  DNS resolution with private-network blocking before every connection.
- Docker image (non-root, no logs), `start.sh` / `start.bat`, English and Spanish READMEs.

[Unreleased]: https://github.com/azweig/offline-entertainment/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/azweig/offline-entertainment/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/azweig/offline-entertainment/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/azweig/offline-entertainment/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/azweig/offline-entertainment/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/azweig/offline-entertainment/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/azweig/offline-entertainment/releases/tag/v0.1.0
