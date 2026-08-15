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
analytics scripts, and third-party origins. It records only the request origin + path (never query
strings) and whether the request was blocked. It also observes `Set-Cookie` response headers to
derive cookie **names** and metadata (HttpOnly, Secure, SameSite flags, expiry date, and domain)
for tracking-cookie detection. It never reads cookie **values**, never modifies cookies, and never
sends cookie data to an external server. (The `cookies` permission is intentionally NOT requested
because TraceGuard only needs cookie names/metadata, which `Set-Cookie` headers already provide.)

## Host Permissions

### `*://*/*`
**Why it is needed:** TraceGuard scores the privacy practices of every website a user visits. Broad
host permissions are required to inject the content script that analyzes on-page forms and trackers
and to observe third-party network requests across the web.

---

## Privacy Policy Compliance Note

- **Local by default:** TraceGuard does not collect, transmit, or monetize user data. Journal data,
  logs, and scores are processed and stored locally on the device.
- **Optional cloud lookup:** The optional "Enhanced Policy Analysis" feature (off by default) sends
  the domain of unrated sites to `api.tosdr.org`. No other browsing data is transmitted.
- **Data deletion:** Users can review, export, or wipe all local data from the dashboard Settings
  ("Export Data" and "Delete All Data").
