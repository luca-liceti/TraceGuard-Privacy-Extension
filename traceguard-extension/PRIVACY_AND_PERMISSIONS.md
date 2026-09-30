# Chrome Web Store permissions justification

The **Privacy practices** tab asks for a separate one-line justification for every permission in the
manifest. The **Form text** under each heading is the exact string to paste into that field. The
prose after it is background for us, not for the form: it names the code that needs the permission
so the justification can be checked rather than taken on trust.

The single-purpose statement, the remote-code answer and the data-usage answers are in
`docs/store-listing/data-usage-questionnaire.md`. The user-facing policy is [PRIVACY.md](../PRIVACY.md),
which is the single source for what is stored, what leaves the device, and how data is deleted. This
file states only why each permission is needed, so the justifications and the policy cannot drift
apart.

## `storage`

**Form text:**

> Persist the user's settings, privacy-score history, cached per-site scores, and notifications locally on-device (chrome.storage.local/session). Sensitive history is encrypted.

**Why it is needed:** TraceGuard runs entirely on the user's local device with no backend. `storage`
persists the local activity journal, privacy-score history, cached domain scores, and user settings.
The session area holds the vault key and the locked-vault buffer, both of which are memory only and
are gone when the browser closes.

## `unlimitedStorage`

**Form text:**

> Store the long-term activity journal on-device: the per-site analysis cache, detector logs, score history, notifications, and the cross-site map of which sites hold which kind of data, all encrypted. Enriched per-site details are large enough that a heavy user can exceed Chrome's default 10 MB local-storage quota.

**Why it is needed:** `storage.local` is bounded at 10 MB by default, and the encrypted journal grows
with every analysed site for as long as the extension stays installed. Per-site enriched details
(cookies, trackers, network requests) are the bulk of it, and a heavy user can legitimately pass the
limit. Removing the cap is what keeps a long-term journal from being truncated.

Do not repeat the older claim that this permission is for the bundled databases. Tracker Radar,
Disconnect, EasyPrivacy, ToS;DR and the phishing blocklist are packaged files loaded into memory by
`src/background/services/database-loader.ts`, which writes nothing to `chrome.storage`, so they
never count against the storage quota.

## `sidePanel`

**Form text:**

> Open TraceGuard's dashboard in the browser side panel so users can monitor their privacy score and per-site analytics persistently while switching tabs.

**Why it is needed:** TraceGuard provides an always-available side-panel view, which is the display
mode where the current site's score follows the user as they switch tabs.

## `tabs`

**Form text:**

> Read the active tab's URL to know which site to score, and follow tab switches so the badge and the side panel track the site the user is on.

**Why it is needed:** The worker reads `tab.url` in the `onActivated` and `onUpdated` handlers to
resolve the domain being scored, and uses those events to update the badge and the side panel
context for the newly active tab. This is the permission behind Chrome's "Read your browsing history"
warning, so the form text should say plainly that the tab URL is read.

## `notifications`

**Form text:**

> Alert the user when a high-risk site is detected or when sensitive data is entered on a low-trust site. Alerts are rationed to at most one per site per browser session, every alert is also listed in the app, and the user can silence them entirely in Settings.

**Why it is needed:** TraceGuard alerts in real time on a risky site or a sensitive entry, and the
user controls the alert level (`Silent`, `Balanced`, `Aggressive`) in Settings. Rationing was added in
v1.13.0 so navigating across a few poor sites does not produce an alert per page.

## `alarms`

**Form text:**

> Schedule periodic background maintenance: re-warming the bundled tracker, policy and threat databases, fetching the signed blocklist update on a user-chosen interval, daily log cleanup, and auto-locking the encrypted vault after inactivity.

**Why it is needed:** `DATABASE_REFRESH_ALARM` runs on the interval the user picks in Settings
(1, 3, 7, 14 or 30 days) and calls `refreshPrivacyDatabases`, which re-warms the bundled databases and
fetches the signed threat-feed update. `CLEANUP_ALARM` runs daily and applies log retention plus a
score snapshot, and `autoLockTimer` locks the vault after the configured idle period.

Do not claim the alarm refreshes policy ratings. Policy data is either bundled or fetched on demand
by the optional Live rating updates setting; no alarm updates it.

## `downloads`

**Form text:**

> Used only for the user-initiated "Export Data" feature, which saves a JSON backup of the user's own locally stored data. TraceGuard never downloads anything else.

**Why it is needed:** The export hands Chrome a locally generated file to save and does not
enumerate, read, or modify any other download. Where the API is unavailable it falls back to a plain
anchor click.

## `webRequest`

**Form text:**

> Passively observe network requests to detect third-party trackers, tracking pixels, Set-Cookie response headers and HTTP security headers. Observational only: it records request origins and cookie names and metadata, never values, and never blocks or modifies a request.

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
traffic entirely, and no requests, cookies, or headers are recorded while paused.

## Host permission

**Form text:**

> TraceGuard scores the privacy practices of every site a user visits. Broad host access is required to inject the analysis content script and observe third-party network requests (trackers, cookies, headers) across the web. All analysis happens locally.

**Why it is needed:** The content script is declared for `*://*/*` because the extension scores
whatever site the user opens, and the observational `webRequest` listener needs the same scope to see
third-party requests. No browsing data leaves the device.
