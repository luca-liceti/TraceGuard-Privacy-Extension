# Chrome Web Store Privacy and Permissions Justification

When submitting TraceGuard to the Chrome Web Store, use the following justifications for the
requested permissions. This helps reviewers understand why each permission is necessary for the
core functionality and reduces the risk of rejection.

## Required Permissions

### `storage` and `unlimitedStorage`
**Why it is needed:** TraceGuard runs entirely on the user's local device with no backend. `storage`
persists the local activity journal, privacy-score history, cached domain scores, and user settings.
`unlimitedStorage` removes Chrome's 5 MB local-storage quota so a long-term journal is not truncated.

### `sidePanel`
**Why it is needed:** TraceGuard provides an always-available side-panel view so users can monitor
their privacy score and per-site analytics persistently as they switch tabs.

### `tabs`
**Why it is needed:** Used to detect tab switches so TraceGuard can update the badge icon, update the
side-panel context to the newly active tab, and release data for inactive tabs.

### `notifications` and `alarms`
**Why it is needed:** TraceGuard alerts users in real time when a high-risk site is detected or when
sensitive input is entered on a risky site. `alarms` schedules periodic background maintenance
(threat-feed refresh and log-retention cleanup).

### `webRequest`
**Why it is needed:** TraceGuard passively observes network requests to detect tracking pixels,
analytics scripts, and third-party origins. It records only the request **origin** (never the path
or query string) and whether the browser stopped it. It also observes `Set-Cookie` response
headers to derive cookie **names** and metadata (HttpOnly, Secure, SameSite flags, expiry date,
and domain) for tracking-cookie detection. It never reads cookie **values**, never modifies
cookies, and never sends cookie data to an external server. (The `cookies` permission is
intentionally NOT requested because TraceGuard only needs cookie names/metadata, which
`Set-Cookie` headers already provide.)

TraceGuard never blocks, redirects, or modifies a request. It has no `declarativeNetRequest`
permission and never uses `webRequest` in its blocking form. The record field is named
`blockedByBrowser` because a request it reports as stopped was stopped by the browser or by another
extension, never by TraceGuard.

When the extension's master on/off toggle is disabled, the network monitor stops observing
traffic entirely, no requests, cookies, or headers are recorded while paused.

### `downloads`
**Why it is needed:** Used only when the user explicitly exports a data backup from Settings. The
extension hands Chrome a locally generated file to save and does not enumerate, read, or modify any
other download. Where the API is unavailable it falls back to a plain anchor click.

## Host Permissions

### `*://*/*`
**Why it is needed:** TraceGuard scores the privacy practices of every website a user visits. Broad
host permissions are required to inject the content script that analyzes on-page forms and trackers
and to observe third-party network requests across the web.

---

## Privacy policy

The user-facing policy is [PRIVACY.md](../PRIVACY.md), which is the single source for what is
stored, what leaves the device, how long the locked-vault buffer lives, and how data is deleted.
This file states only why each permission is needed, so the justifications and the policy cannot
drift apart.
