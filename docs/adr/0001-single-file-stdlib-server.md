# ADR 0001: One Python file using only the standard library

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
The people who run this are individuals on a laptop or a small home server, often on Windows. Every
extra dependency is one more thing to install, update and audit. The server's job is small: check a
key, validate input, start yt-dlp and stream one file.

## Decision
`server.py` uses `http.server.ThreadingHTTPServer` and the rest of the standard library. The only
third-party dependency is `yt-dlp[default]`. There is no web framework, ORM or task queue.

## Consequences
- Installs anywhere Python 3.11+ runs; the whole server can be read in one sitting (~650 lines).
- No middleware ecosystem: security headers, request limits and routing are written by hand and must
  be covered by tests.
- `ThreadingHTTPServer` is fine for one household (a handful of concurrent requests). It is not meant
  for public or high-traffic use, which is also out of scope (see ADR 0005).
