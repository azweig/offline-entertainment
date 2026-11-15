# ADR 0002: The library lives on the phone; the server is a pass-through

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
The point of the app is watching with **no connection**, so the files must be on the phone anyway.
Keeping a second copy on the server would add a database, disk usage, backups and a record of what
someone watched.

## Decision
The server prepares each file in a private temp folder, streams it to the phone and deletes it as
soon as the last byte is sent. An interrupted transfer keeps the file for up to 60 minutes so the
phone can resume it (see [ADR 0006](0006-resumable-downloads.md)). Files nobody collects are removed
after 60 minutes; each run uses a new private temp folder that is removed on exit. The phone stores media in OPFS (IndexedDB
fallback) and asks for persistent storage. Playlists and preferences live in `localStorage`.

## Consequences
- The server holds no history, titles or logs: nothing to leak, back up or subpoena.
- If a transfer breaks, the user saves the item again (the app retries automatically in batches).
- Each phone/browser has its own library. Clearing the browser's site data deletes it; on iPhone,
  installing to the home screen avoids Safari's storage eviction.
