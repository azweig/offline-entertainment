## What and why

<!-- What does this change and why is it needed? Link the issue if there is one. -->

## How I tested it

<!-- e.g. `make check`, plus what you tried on a phone (model, browser, online/offline). -->

## Checklist

- [ ] `make check` passes (lint, unit tests, real start-up).
- [ ] Every new outbound request goes through `check_url()` and its URL is built on the server.
- [ ] New sites list exact yt-dlp extractor names in `SITES` (never `generic`) and appear in both READMEs.
- [ ] The server still keeps no history, titles or logs.
- [ ] No account cookies, proxies, browser impersonation or block evasion.
- [ ] Remote text reaches the page only through `esc()` / `textContent`.
- [ ] Docs updated (`README.md`, `README.es.md`, `docs/`) and an entry added to `CHANGELOG.md`.
