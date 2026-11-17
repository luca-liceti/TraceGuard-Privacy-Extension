# 0001. Local-first, with no backend and no telemetry

**Status:** Accepted
**Date:** 2026-09-13

## Context

TraceGuard reads browsing activity: domains, cookie names, request origins, and the types of form
fields the user interacts with. Aggregated on a server, that is a detailed map of one person's
life, and it would make the extension a high-value target. The product's value also depends on the
user believing what it says, which is difficult to sustain if data leaves the device.

## Decision

Core detection, scoring, and storage happen on the user's device in `chrome.storage.local`. There is
no backend, no account, and no analytics, telemetry, or crash reporting. Optional network features
are explicit exceptions to "local-first": the threat-feed refresh and shared catalog updates download
public data, Live Rating Lookup can send a site domain to ToS;DR, local AI sends selected facts to the
user's Ollama server on the same device, and Local Policy Reports fetch policy pages from the sites
being checked before sending selected policy text to that Ollama server. A browser-rendered policy
fallback may use the site's cookies. See `PRIVACY.md` for the full data and trigger details.

## Consequences

- Documentation must distinguish core on-device analysis from optional network requests. It must not
  claim that browsing data is never sent anywhere: a domain can go to ToS;DR, policy-page requests
  reach the policy hosts, and user-selected AI features send facts or policy text to local Ollama.
- Features that need a backend remain out of scope by construction: cross-user reputation, community
  blocklists, and server-side policy analysis.
- Debugging happens through the local diagnostics log. There is no remote error stream, so a bug a
  user hits is only visible if they report it.
- Adding any further network call changes what the product is. That requires a new record rather
  than an edit to this one.
