# ADR 0006: Resumable downloads

- **Status:** Accepted (refines [ADR 0002](0002-library-lives-on-the-phone.md))
- **Date:** 2026-11-15

## Context
Phones freeze web apps that are not on screen: iPhone always, Android after a short while. A
transfer from the server stops as soon as you switch apps or the screen turns off. With the original
"send once, delete in `finally`" rule, a cut transfer was lost and the server had to prepare the file
again from the site, which is slow for long videos and repeats requests to the site.

A web app cannot keep downloading in the background on iPhone (Background Fetch is not available
in Safari), so the fix has to be "continue where it stopped", not "never stop".

## Decision
- **Server:** `GET /api/jobs/{id}/file` accepts `Range: bytes=N-` and answers `206`. The file is
  deleted only after the last byte is written. If the transfer breaks, the file is kept, the
  `sending` flag is cleared and the 60-minute `TTL` starts again. A connection that stops reading
  for 60 s is dropped, so a frozen phone does not hold the transfer.
- **Phone:** received bytes are written as confirmed 8 MB parts (`.part-<job>-<n>`, hidden from the
  library). The job id is kept with the queued item in `localStorage`, so after a freeze or even a
  restart of the app it asks only for the missing bytes. Parts are joined into the final file and
  checked against the expected size. Parts that no queued item needs are removed at start.
- **While downloading:** the app requests a screen Wake Lock, and in a playlist batch the server
  prepares the next song while the current one is being saved.

## Consequences
- A file can now stay on the server up to 60 minutes after a cut transfer (was: deleted at once).
  It is still deleted as soon as it arrives complete and always when the server stops.
- Only one transfer per job at a time (`409` otherwise), so the parts on the phone stay consistent.
- iPhone still pauses in the background; it resumes when you return. Android may continue a while.
