# 0001. Local-first, with no backend and no telemetry

**Status:** Accepted
**Date:** 2026-09-13

## Context

TraceGuard reads browsing activity: domains, cookie names, request origins, and the types of form
fields the user interacts with. Aggregated on a server, that is a detailed map of one person's
life, and it would make the extension a high-value target. The product's value also depends on the
user believing what it says, which is difficult to sustain if data leaves the device.

## Decision

All detection, scoring, and storage happen on the user's device in `chrome.storage.local`. There is
no backend, no account, and no analytics, telemetry, or crash reporting.

Two network requests exist, and both carry data rather than browsing history:

1. The signed threat-feed refresh, which downloads a phishing blocklist and sends nothing.
2. Enhanced Policy Analysis, off by default, which sends only the domain of an unrated site to
   ToS;DR.

## Consequences

- The privacy policy can make absolute claims, and the store questionnaire can answer "no browsing
  data is transmitted" with a single named exception.
- Features that need a server are out of scope by construction: cross-user reputation, community
  blocklists, server-side policy analysis.
- Debugging happens through the local diagnostics log. There is no remote error stream, so a bug a
  user hits is only visible if they report it.
- Adding any further network call changes what the product is. That requires a new record rather
  than an edit to this one.
