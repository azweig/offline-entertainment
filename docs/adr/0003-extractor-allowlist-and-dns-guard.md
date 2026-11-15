# ADR 0003: Closed site allowlist, exact extractors and a DNS guard

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
yt-dlp can open almost any URL, including through its `generic` extractor, which fetches arbitrary
pages. A server that downloads whatever URL it is given is a classic SSRF tool: it could be pointed at
the router admin page, cloud metadata (169.254.169.254) or other services on the home network.

## Decision
1. **YouTube** links are reduced to an 11-character ID and the URL is rebuilt on the server.
2. **Other sites** must match a closed list (`SITES`). The URL is rebuilt: `https` only, no
   user/password, no port, no fragment, max 500 characters.
3. yt-dlp is restricted with `allowed_extractors` to the **exact extractor names** of that site;
   `generic` is never allowed.
4. Before **every** outbound connection (page, each media format URL, thumbnails) `check_url()`
   resolves the hostname and rejects the request if **any** address is private, loopback, link-local,
   CGNAT, multicast, reserved or unspecified (IPv4-mapped IPv6 included).

## Consequences
- Adding a site is a deliberate code change reviewed in a PR (see CONTRIBUTING.md).
- Known residual risk: DNS rebinding between our check and yt-dlp's own connection, and redirects
  followed inside yt-dlp/ffmpeg, are not re-checked. See [security.md](../security.md#residual-risks).
