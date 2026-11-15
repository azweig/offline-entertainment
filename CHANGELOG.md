# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/azweig/offline-entertainment/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/azweig/offline-entertainment/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/azweig/offline-entertainment/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/azweig/offline-entertainment/releases/tag/v0.1.0
