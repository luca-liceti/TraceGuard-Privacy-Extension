# Architecture

How TraceGuard is put together, and why. Decisions and their reasoning live in
[`adr/`](adr/README.md); this file describes the system as it exists.

## What it is

A Manifest V3 Chrome extension that scores the privacy practices of every site a user visits and
tracks the user's own footprint over time. It runs entirely on the device: no backend, no account,
no telemetry. Two scores are produced:

- **Website Safety Score (WSS)**, 0 to 100, per site, per analysis.
- **User Privacy Score (UPS)**, 0 to 100, a rolling behavioural score for the user.

Code lives in `traceguard-extension/`. Build output is `traceguard-extension/dist/`, which is what
Chrome loads.

## Runtime contexts

Five contexts, defined by `manifest.json`. They do not share memory, so anything they share goes
through `chrome.storage`.

| Context | Entry point | Responsibility |
|---|---|---|
| Background service worker | `src/background/index.ts` | The only writer of authoritative state. Holds the vault key. Runs enrichment, scoring, migrations, retention, alarms, and the threat-feed refresh. |
| Content script | `src/content/index.ts` | Runs on every page (`*://*/*`, `document_idle`). Runs the page detectors, extracts candidates, shows the in-page PII confirmation card, and relays diagnostics to the worker. |
| Popup | `src/popup/index.html` | The toolbar popup: current-site summary. |
| Side panel | `src/sidepanel/index.html` | The persistent panel: current-site detail while switching tabs. |
| Dashboard | `src/dashboard/index.html` | The React app with routes: Overview, Rankings and Stats, Footprint. |

The extension requests `storage`, `unlimitedStorage`, `sidePanel`, `tabs`, `notifications`,
`alarms`, `downloads`, and `webRequest`, plus host permission `*://*/*`. `webRequest` is used in its
observational form only: the extension monitors network activity and never blocks anything. See
record [0002](adr/0002-no-cookies-permission.md) for why `cookies` is deliberately absent.

## How a page is analyzed

1. **Content script.** On load, `src/content/` runs the detectors in `src/content/detectors/`
   (`tracking`, `cookie`, `input`, `policy`, `fingerprinting`) plus the in-page header scan. It
   reads structure, never field values.
2. **Message to the worker.** Results are sent to the background worker, which owns the scoring
   because it holds the vault key (`PII_DETECTED` for form interaction, analysis payloads for the
   rest).
3. **Enrichment.** Worker services in `src/background/services/` turn raw observations into named
   entities: `reputation`, `tracker-enricher` (DuckDuckGo Tracker Radar and Disconnect), `cookie-enricher`,
   `header-analyzer`, and `database-loader`, which loads the bundled databases.
4. **Scoring.** `explainWSS` in `src/lib/scoring.ts` combines detector results with the weights below
   and returns both the score and the arithmetic behind it. `calculateWSS` wraps it so a score and
   its audit trail cannot disagree.
5. **Write.** The worker writes `siteCache`, `detectorLogs`, `scoreHistory`, `crossSiteExposure`, and
   `piiDetections`, encrypting them with the vault key.
6. **Read.** UI code reads through the hooks in `src/lib/useStorage.ts`, which decrypt and subscribe
   to `chrome.storage.onChanged`.

## Storage model

Everything is in `chrome.storage.local` except the two vault keys, which live in
`chrome.storage.session` so they are gone when the browser closes.

| Key | Holds | Encrypted |
|---|---|---|
| `settings` | Theme, notification preferences, whitelist and blacklist | No |
| `state` | UPS, sites analyzed, safe streak, PII event count | No |
| `siteCache` | Per-domain analysis: WSS, detector details, enriched trackers, cookies, headers | Yes |
| `detectorLogs` | Per-detector results over time, capped | Yes |
| `scoreHistory` | UPS changes over time | Yes |
| `piiDetections` | Field-type interaction events (capped at 100) | Yes |
| `crossSiteExposure` | Field type to domains: which sites know an email, card, and so on | Yes |
| `notifications` | Alerts shown to the user | Yes |
| `logs` | General log entries | Varies |
| `tosdr_cache` | Optional ToS;DR lookup results, domain to grade. Plaintext by design, it holds no page data | No |

Session keys: `cryptoKeyHex` (the vault key) and `bufferKeyHex` (the buffer key below). Session
storage is restricted to trusted contexts via `chrome.storage.session.setAccessLevel`; a content
script must never be able to read the master key.

## The vault and the buffer

Sensitive stores are encrypted with AES-256-GCM under a key derived from a master password the user
creates.

- While the vault is unlocked, `cryptoKeyHex` is in session storage and the worker encrypts writes.
- While it is locked, writes cannot be encrypted with the vault key, so activity is buffered on disk
  under a separate `bufferKeyHex`.
- `flushBufferedTelemetry` merges the buffer back into the encrypted stores on unlock.

**Consequence worth knowing:** because the buffer is merged in, deleting a record from an encrypted
store is not permanent unless the matching buffer entry is removed in the same operation. This is
the trap behind any future "forget" action.

## Scoring

### Website Safety Score

Weights, from `src/lib/scoring.ts`:

| Detector | Weight |
|---|---|
| Reputation | 0.25 |
| Tracking | 0.25 |
| Cookies | 0.15 |
| Fingerprinting | 0.15 |
| Input fields | 0.10 |
| Policy | 0.10 |

When the policy detector has no rating (ToS;DR does not cover the site), policy is a fallback. Its
weight is set to zero and the remaining weights are scaled up so the total stays at 1. This is
documented here because it is the mechanism by which unrated sites score higher than they should,
which record [0006](adr/0006-asymmetric-policy-ratings.md) exists to address.

### User Privacy Score

Rules live in `src/lib/pii.ts`. `SAFE_WSS_THRESHOLD` is 70.

- **Visit penalty:** `((100 - WSS) / 100) * 2`, rounded to one decimal. A perfect site costs nothing,
  the worst site costs 2.
- **PII penalty:** `round(basePenalty * (1 + (100 - WSS) / 100))`. On a safe site (WSS above 70) the
  entry is treated as expected use and is not penalized. Base penalties: SSN 10, card 9, password 8,
  phone 5, email 4, address 3, security code 3, OTP 3, username 2, name 1.
- **Recovery:** `((WSS - 70) / 30) * 0.1` on the first visit to a distinct safe domain, capped at
  0.1.

The arithmetic is deliberately lopsided: one bad visit can cost 2 points while a safe visit returns
at most 0.1. That is a design problem recorded in `ROADMAP.md`, not an accident.

## Databases and feeds

All bundled at build time, so analysis works offline:

| Source | Used for |
|---|---|
| DuckDuckGo Tracker Radar | Tracker ownership, categories, and organisation names |
| Disconnect | Canonical entity names per domain |
| EasyPrivacy | Additional tracker matching |
| ToS;DR | Policy grades for covered services |
| OpenPhish, phishunt | Phishing and malware domains |

The blocklist is refreshed between releases as a signed `phishlist.signed.json`, verified with
Ed25519 against an embedded public key, accepted only when it is newer than what is stored, and
falling back to the bundled snapshot on any failure. See the README for the key-management commands.

## Diagnostics

`src/lib/diagnostics.ts` is the only failure-reporting path. `captureError` records a genuine fault
to a durable log; `logEvent` records a transient or expected condition to the session log. Developer
mode, off by default, makes verbose events persist; they go to `chrome.storage.session`, are wiped
when the browser closes, and are never written to disk.

Content scripts cannot write session storage because that would expose the vault key, so they batch
events and relay them with `DIAGNOSTIC_EVENTS`; the worker is the only writer.

## Known limitations

These are properties of the design, not bugs to be fixed quietly:

- **Values are never seen.** The extension knows a password field was used, never a password. It
  cannot detect password reuse or what a site did with data afterwards. See record
  [0003](adr/0003-pii-field-types-only.md).
- **Typing is not sending.** A footprint entry means the user started typing, on the first
  keystroke. An abandoned form looks identical to a submitted one.
- **No blocking.** TraceGuard observes. A request recorded as "blocked" was blocked by the browser
  or by another extension, not by this one.
- **Cookie coverage is partial.** Names and metadata come from `Set-Cookie` headers, so cookies set
  before install are invisible.
- **ToS;DR coverage is thin** relative to the number of sites in existence, and the fallback
  redistribution inflates unrated sites.
- **`crossSiteExposure` grows without bound.** It is the one collection with no cap, and the
  footprint ledger reads it.
- **The ledger is empty on install** until the user types into a sensitive field somewhere.
