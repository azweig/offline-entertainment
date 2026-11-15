# ADR 0005: No accounts, cookies, proxies or block evasion

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
Downloaders are often extended with "use your browser cookies", proxy rotation or impersonation to
get past logins and rate limits. Those features turn a personal tool into account-scraping
infrastructure, put users' accounts at risk and invite legal trouble.

## Decision
The project only handles **public** content reachable without logging in. It will not accept features
for account cookies or logins, proxies, browser impersonation, getting around site blocks, or public /
multi-user hosting. Errors that mean "login required" or "blocked in your country" are shown as clear
messages instead.

## Consequences
- Some content (private, age-gated, region-locked) cannot be saved. That is intended.
- YouTube often blocks datacenter IPs; the project is meant for a home connection.
- PRs adding those features are closed with a link to this ADR.
