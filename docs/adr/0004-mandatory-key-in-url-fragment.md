# ADR 0004: A key is always required, handed over in the URL fragment

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
"It only listens on localhost" stops being true the moment someone uses `--host 0.0.0.0`, Docker port
mappings or a tunnel. An optional password is usually left empty. Typing a long random key on a phone
is painful, which pushes people towards weak keys.

## Decision
- There is no mode without a key. If `OFFLINE_KEY` is not set, a 32-character key
  (`secrets.token_urlsafe(24)`) is generated on first start and stored with mode `0600`, created with
  `O_CREAT | O_EXCL`. Keys shorter than 12 characters are rejected.
- Every `/api/*` request must carry `X-Key`; it is compared with `hmac.compare_digest`.
- The terminal prints `http://127.0.0.1:8765/#k=<key>` (only when stdout is a TTY, so the key does not
  end up in service logs). The fragment is never sent in HTTP requests; the app stores it in
  `localStorage` and removes it from the address bar with `history.replaceState`.

## Consequences
- One tap to log in on the same machine; on the phone the key is typed or pasted once per device.
- The key lives in the phone's `localStorage`: anyone with the unlocked phone can use the app. That is
  acceptable for a personal tool and documented in the threat model.
- A header (not a cookie) means no CSRF exposure: other sites cannot make the browser attach it.
