# Security policy

## Supported versions

Only the latest release on `main` receives security fixes. Keep yt-dlp up to date too (`make update`):
most real-world breakage and some security fixes come from there.

| Version | Supported |
|---|---|
| 1.x (latest) | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

**Please do not open a public issue.** Report it privately through GitHub:
**Security → Report a vulnerability**
(<https://github.com/azweig/offline-entertainment/security/advisories/new>).

Include what you can of:

- the affected version or commit, and how you run it (local, Docker, behind a proxy);
- the steps to reproduce, or a proof of concept;
- the impact you expect (e.g. reaching an internal address, reading a file, bypassing the key).

What to expect:

| Step | Target |
|---|---|
| Acknowledgement | within 3 days |
| First assessment (accepted / not a vulnerability / more info needed) | within 7 days |
| Fix released for confirmed High/Critical issues | within 30 days |
| Public advisory and credit (if you want it) | when the fix is released |

## Scope

In scope: `server.py`, the files in `static/`, the Docker image and `docker-compose.yml`, the start
scripts and the CI workflows. Typical examples: key bypass, SSRF to private networks, path traversal,
XSS in the app, leaking the key, anything that makes the server keep data it shouldn't.

Out of scope:

- Vulnerabilities in yt-dlp, ffmpeg, Deno or Python themselves (report them upstream; tell us if we
  need to pin or work around something).
- Attacks that require the key, physical access to the unlocked phone, or control of the host.
- Instances deliberately exposed without HTTPS or with a weak `OFFLINE_KEY`.
- Content sites blocking or rate-limiting the server.

## How the project is secured

See [docs/security.md](docs/security.md) for the threat model, the controls and how they are tested,
the latest security review and the known residual risks.
