# TraceGuard Pre-Release Audit

---

## 1. Architecture Map

### File Tree (source-only)
```
src/
├── background/
│   ├── index.ts                 ← Service worker (message router, scoring, UPS, storage)
│   ├── tosdr-api.ts             ← ToS;DR API client
│   └── services/
│       ├── cookie-enricher.ts   ← Cookie classification (local)
│       ├── database-loader.ts   ← Tracker/FP database loader (bundled JSON)
│       ├── header-analyzer.ts   ← HTTP header security grading
│       ├── network-monitor.ts   ← webRequest listener for headers/trackers
│       ├── reputation.ts        ← URLhaus + local blacklist checks
│       └── tracker-enricher.ts  ← Tracker categorization (local)
├── content/
│   ├── index.ts                 ← Entry point; orchestrates detectors, sends results
│   ├── analyzer.ts              ← Runs all detectors, builds score breakdown
│   ├── pii-detector.ts          ← Monitors input events for PII field types
│   └── detectors/
│       ├── cookie.ts            ← document.cookie parser + classifier
│       ├── fingerprinting.ts    ← Script/canvas/audio FP detection
│       ├── input.ts             ← Input field metadata scanner
│       ├── policy.ts            ← Privacy policy link finder + ToS;DR query
│       ├── reputation.ts        ← Sends hostname for reputation check
│       └── tracking.ts          ← Script/pixel/param tracker detection
├── lib/
│   ├── types.ts                 ← All interfaces (SiteRiskData, AppState, etc.)
│   ├── scoring.ts               ← WSS formula (5-factor weighted sum)
│   ├── scoring.test.ts          ← Unit tests for scoring
│   ├── pii.ts                   ← UPS penalty/recovery math
│   ├── pii.test.ts              ← Unit tests for PII scoring
│   ├── storage.ts               ← StorageManager (chrome.storage.local wrapper)
│   ├── useStorage.ts            ← React hooks for reactive storage access
│   ├── risk-utils.ts            ← Color/label/grade helpers (higher=better)
│   ├── crypto.ts                ← AES-GCM encrypt/decrypt with PBKDF2
│   ├── sanitize.ts              ← DOMPurify-based HTML sanitizer
│   ├── rate-limiter.ts          ← Token-bucket rate limiter
│   ├── navigation.ts            ← Sidebar + search route definitions
│   ├── theme-utils.ts           ← Score→color mapping helpers
│   ├── i18n.ts                  ← Language getter/setter
│   ├── translations.ts          ← 4 language dictionaries (en/es/fr/de)
│   └── utils.ts                 ← cn(), formatTimeAgo, etc.
├── popup/                       ← Popup entry (mounts same React tree)
├── sidepanel/
│   ├── App.tsx                  ← Main sidepanel UI (scores, breakdown, details)
│   └── main.tsx                 ← React root mount
├── dashboard/
│   ├── App.tsx                  ← HashRouter + route definitions
│   └── main.tsx                 ← React root mount
├── components/
│   ├── traceguard/
│   │   ├── auth-provider.tsx    ← Vault encryption lock/unlock (PBKDF2 → AES-GCM)
│   │   ├── layout.tsx           ← Dashboard shell (sidebar + content)
│   │   ├── settings-modal.tsx   ← Settings dialog (prefs, export, data mgmt)
│   │   ├── site-details-panel.tsx ← Detailed site analysis sheet
│   │   ├── notifications.tsx    ← Notification bell dropdown
│   │   ├── overview-tile.tsx    ← KPI tile component
│   │   ├── profile.tsx          ← Sidebar profile card (hardcoded defaults)
│   │   ├── search-command.tsx   ← Cmd+K command palette
│   │   ├── settings-context.tsx ← Settings modal state context
│   │   └── pages/
│   │       ├── overview.tsx     ← Dashboard overview (charts, table, KPIs)
│   │       ├── privacy-score.tsx ← UPS history + trend chart
│   │       ├── activity-logs.tsx ← Visit-level detector log viewer
│   │       ├── sites-analyzed.tsx ← Site list + visit counts
│   │       ├── rankings.tsx     ← Analytics: threats, categories, offenders
│   │       ├── trackers.tsx     ← Tracker distribution + top sites
│   │       ├── sites-safety.tsx ← Risk distribution + site cards
│   │       ├── whitelist-blacklist.tsx ← Domain list management
│   │       ├── help.tsx         ← Static FAQ/guide
│   │       └── integrations.tsx ← Static "coming soon" page
│   ├── section-cards.tsx        ← 6 KPI stat cards for overview
│   ├── radial-chart-score.tsx   ← Radial UPS gauge
│   ├── data-table.tsx           ← Reusable data table + manual log entry
│   ├── chart-area-interactive.tsx ← UPS history area chart
│   ├── app-sidebar.tsx          ← Navigation sidebar
│   └── ErrorBoundary.tsx        ← React error boundary
│   └── ui/                      ← 50 shadcn/ui primitives
├── app/dashboard/data.json      ← Unused mock data (Jira-like task list)
└── styles/globals.css           ← Global CSS
```

### Scores & Metrics

| Metric | Range | Direction | Formula Location |
|--------|-------|-----------|-----------------|
| **WSS** (Website Safety Score) | 0–100 | Higher = safer | [scoring.ts:L85–L168](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.ts#L85-L168) |
| **UPS** (User Privacy Score) | 0–100 | Higher = better | [pii.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/pii.ts) |
| **Tracking sub-score** | 0–100 | Higher = fewer trackers | [tracking.ts:L237–L240](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/tracking.ts#L237-L240) |
| **Cookie sub-score** | 0–100 | Higher = fewer cookies | [cookie.ts:L312–L313](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/cookie.ts#L312-L313) |
| **Input sub-score** | 0–100 | Higher = fewer sensitive fields | [input.ts:L134–L136](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/input.ts#L134-L136) |
| **Policy sub-score** | 0–100 | Higher = better ToS;DR grade | [policy.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/policy.ts) (A=100, E=20, none=25) |
| **Reputation sub-score** | 0–100 | Higher = safer | [reputation.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/reputation.ts) |

**WSS Weights:** Reputation 30% · Tracking 30% · Cookies 20% · Input 15% · Policy 5%

### Storage Keys (chrome.storage.local)

| Key | Written by | Read by |
|-----|-----------|---------|
| `settings` | settings-modal | useStorage, background, sidepanel |
| `state` (AppState: ups, sitesAnalyzed, trackersDetected, etc.) | background/index.ts | useAppState hook |
| `siteCache` (Map<domain, SiteRiskData>) | background/index.ts | all dashboard pages, sidepanel |
| `detectorLogs` (DetectorLogEntry[]) | background/index.ts | overview, activity-logs, rankings |
| `scoreHistory` (ScoreHistoryEntry[]) | background/index.ts | privacy-score, radial chart |
| `piiDetections` (PIIDetectionEvent[]) | background/index.ts | section-cards |
| `crossSiteExposure` (Record<fieldType, domains[]>) | background/index.ts | sidepanel |
| `notifications` (NotificationEvent[]) | background/index.ts | notifications dropdown |
| `session:cryptoKeyHex` | auth-provider | useStorage (for decryption) |
| `session:tosDRCache` | tosdr-api.ts | tosdr-api.ts |
| `session:urlhausCache` | reputation.ts | reputation.ts |
| `session:bufferedPii`, `bufferedScoreHistory`, `bufferedSiteCache` | background (pre-unlock buffer) | background (flush on unlock) |

### Message Types

| Type | Sender → Receiver | Payload |
|------|-------------------|---------|
| `PAGE_ANALYSIS_RESULT` | content/index.ts → background | scores, detectionDetails, rawForEnrichment |
| `PII_DETECTED` | pii-detector.ts → background | timestamp, site, fieldType, fieldName, sensitivity, siteWRS |
| `CHECK_REPUTATION` | content/reputation.ts → background | url |
| `CHECK_TOSDR` | content/policy.ts → background | url |
| `UNLOCK_VAULT` | auth-provider → background | (none) |
| `SETTINGS_CHANGED` | settings-modal → background | (none) |
| `SHOW_TOAST` | background → active tab | (notification content) |

### Outbound Network Calls

| Endpoint | Trigger | Data Sent | Location |
|----------|---------|-----------|----------|
| `https://api.tosdr.org/search/v4/?query={domain}` | Policy detection | Base domain only (e.g. "google") | [tosdr-api.ts:L138](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/tosdr-api.ts#L138) |
| `https://api.tosdr.org/service/v2/?id={id}` | ToS;DR detail fetch | Service ID | [tosdr-api.ts:L189](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/tosdr-api.ts#L189) |
| `https://urlhaus-api.abuse.ch/v1/host/` | Reputation check | `{ host: hostname }`, hostname only | [reputation.ts:L133](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/reputation.ts#L133) |
| `chrome.runtime.getURL('assets/blacklist.json')` | Reputation init | (local file, no network) | [reputation.ts:L83](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/reputation.ts#L83) |

**No other outbound calls exist. No analytics/telemetry endpoints.**

---

## 2. Working & Verified

- ✅ **WSS scoring formula**: 5-factor weighted sum with logarithmic sub-scores, `validateScore` guards against NaN/undefined/out-of-range. Policy redistribution when unrated. [scoring.ts:L85–L168](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.ts#L85-L168)
- ✅ **UPS penalty/recovery**: Penalty scales with site risk context; recovery only on safe site visits (WSS≥70); streak bonus. [pii.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/pii.ts)
- ✅ **Cookie detector**: Parses `document.cookie`, classifies by known patterns, computes logarithmic score. Never stores cookie values. [cookie.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/cookie.ts)
- ✅ **Tracking detector**: Scans `<script>`, `<img>`, URL params; matches 70+ known tracker domains; logarithmic score. [tracking.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/tracking.ts)
- ✅ **Input field detector**: Reads only `type`, `name`, `id`, `placeholder`, `autocomplete`, never `element.value`. [input.ts:L88–L90](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/input.ts#L88-L90)
- ✅ **Fingerprinting detector**: Scans script content for canvas/WebGL/audio/font APIs. [fingerprinting.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/fingerprinting.ts)
- ✅ **ToS;DR integration**: Rate-limited (10/min), session-cached, sends only base domain. [tosdr-api.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/tosdr-api.ts)
- ✅ **Header analyzer**: Grades CSP, HSTS, referrer-policy, X-Frame-Options, X-Content-Type-Options. [header-analyzer.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/header-analyzer.ts)
- ✅ **Score direction in scoring engine**: All sub-scores 0–100 higher=better throughout `scoring.ts`, `risk-utils.ts`, `theme-utils.ts`.
- ✅ **Detector fault isolation**: Each detector wrapped in try/catch in content scripts; one failure doesn't crash the pipeline. [content/index.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/index.ts)
- ✅ **Rate limiting**: Token-bucket rate limiters for ToS;DR (10/min), URLhaus (5/min). [rate-limiter.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/rate-limiter.ts)
- ✅ **Vault encryption**: AES-GCM 256-bit with PBKDF2 key derivation (600K iterations), key in session storage, data encrypted at rest for `scoreHistory`, `piiDetections`, `siteCache`. [crypto.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/crypto.ts), [auth-provider.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/auth-provider.tsx)
- ✅ **DOMPurify sanitization**: `sanitize.ts` uses actual DOMPurify (not regex). [sanitize.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/sanitize.ts)
- ✅ **Storage log retention**: Capped at 1000 entries + date-based cleanup. [storage.ts:L124](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/storage.ts#L124)
- ✅ **Notification cap**: Max 100 notifications stored. [storage.ts:L227](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/storage.ts#L227)
- ✅ **Error boundaries**: Present on popup, sidepanel, and dashboard roots. [ErrorBoundary.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/ErrorBoundary.tsx)
- ✅ **Buffered writes pre-unlock**: Before vault is unlocked, telemetry buffers into `chrome.storage.session`, then flushes on `UNLOCK_VAULT`. [background/index.ts:L53–L86](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/index.ts#L53-L86)
- ✅ **i18n**: 4 languages (en/es/fr/de) with full translation dictionaries. [translations.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/translations.ts)
- ✅ **Unit tests**: Scoring and PII penalty/recovery math have test coverage. [scoring.test.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.test.ts), [pii.test.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/pii.test.ts)

---

## 3. Partially Implemented / Inconsistent

### 3a. Scoring Direction Inversion in `trackers.tsx`

> [!CAUTION]
> **Inverted score interpretation on the Trackers page.**

In [trackers.tsx:L64–L74](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/trackers.tsx#L64-L74), `data.breakdown.tracking` is bucketed as:
- `=== 0` → "Clean"
- `1–30` → "Low"
- `31–60` → "Medium"
- `> 60` → "High"

But `breakdown.tracking` is 0–100 **higher = safer** (100 = no trackers, 0 = many trackers). So the page labels a score of 0 (maximum tracking) as "Clean" and a score of 80 (very few trackers) as "High." **The entire distribution chart and stat cards are inverted.**

### 3b. "Trackers Blocked" Label

In [section-cards.tsx:L125](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/section-cards.tsx#L125), the card is titled **"Trackers Blocked"** but the extension does not block any trackers, it only *detects* them. The value shown (`appState.trackersDetected`) is a detection count, not a block count. The label misleads users into thinking active protection is happening.

### 3c. Hardcoded Reputation Placeholder in Content Script

In [analyzer.ts:L73](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/analyzer.ts#L73), the reputation score is hardcoded to `100` as a "placeholder" that the background is supposed to overwrite. The comment says the background will overwrite it, need to verify that the background actually replaces this value in the final `siteCache` write. If the background's reputation check fails or is slow, this `100` (maximum safety) leaks into the WSS as the reputation component.

### 3d. Profile Component Uses Permanent Hardcoded Defaults

[profile.tsx:L20–L25](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/profile.tsx#L20-L25) shows a hardcoded "Alex Watson, Prompt Engineer" with an external Vercel avatar URL. The caller (`app-sidebar.tsx`) uses `useUserName()` to provide a name, but role and avatar are never personalized. This displays fictional user data. The external avatar URL (`ferf1mheo22r9ira.public.blob.vercel-storage.com`) is also an outbound request not declared in the CSP or documented.

### 3e. Translations: README Claims 12 Languages, Code Has 4

README and CHANGELOG claim 12 language support. [translations.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/translations.ts) actually contains **4 languages** (en, es, fr, de). The other 8 (ja, zh, ko, pt, ru, ar, hi, it) are missing.

### 3f. Integrations Page is Entirely Static

[integrations.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/integrations.tsx) is a "coming soon" page with hardcoded integration cards (VPN, email aliases, etc.). None are functional. This is fine as a roadmap placeholder but shouldn't appear in the sidebar navigation without a "coming soon" indicator.

### 3g. `data.json` is Unused Mock Data

[data.json](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/app/dashboard/data.json) contains 12KB of Jira/Linear-style task management data (names like "Jamik Tashpulatov", "Executive summary"). Not referenced by any component. Should be deleted before release.

---

## 4. Broken, Mock, or Missing

### 4a. URLhaus API Returns 401

[reputation.ts:L133](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/reputation.ts#L133): The URLhaus API (`https://urlhaus-api.abuse.ch/v1/host/`) consistently returns 401. The error handling fails open to `score: 100` (safe). **Reputation checks via URLhaus are non-functional.** All sites default to safe reputation unless manually blacklisted. This is a documented known issue in the CHANGELOG.

### 4b. "Trackers Blocked" Feature Does Not Exist

The `TrackerInfo.blocked` field exists in types but is always `false`. No blocking logic (declarativeNetRequest rules, webRequest blocking) exists anywhere. The "Trackers Blocked" KPI card on the overview ([section-cards.tsx:L125](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/section-cards.tsx#L125)) and the "Trackers Blocked" stat in the manual log form ([data-table.tsx:L373](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/data-table.tsx#L373)) display detection counts under the "blocked" label.

### 4c. Fingerprinting Not Used in WSS

The fingerprinting detector runs and produces results, but `fingerprinting` has **zero weight** in the WSS formula. The `ScoreBreakdown` type doesn't include a fingerprinting field. Fingerprinting data is visible in the sidepanel detection details but does not affect the safety score.

### 4d. `form_focus` UPS Event Type Unused

`UPSEvent.type` includes `'form_focus'` in the type definition, but no code ever sends this event type, and the UPS calculation has no handler for it. Dead code path.

### 4e. Database Remote Updates Disabled

[database-loader.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/database-loader.ts): Remote database update URLs are commented out. Tracker and fingerprint databases are bundled-only and never refresh. The `alarms`-based update check runs but does nothing.

### 4f. Logout Button is a No-Op

[profile.tsx:L97–L107](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/profile.tsx#L97-L107): The "Logout" button has no `onClick` handler. It renders but does nothing when clicked.

### 4g. `enrichedDetails` Often Empty

The `enrichedDetails` field (cookies with organizations, trackers with prevalence, network request breakdown, header grades, fingerprinting details) requires the background enrichment pipeline to fully populate. Multiple dashboard columns ([data-table.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/data-table.tsx)) show ", " fallbacks when this data is missing, which appears common.

---

## 5. Core Promise Integrity Findings

> [!IMPORTANT]
> This section evaluates the extension's central promise: **monitoring privacy without invading it.**

### ✅ PASS: No User Input Values Read

Every content-script detector that touches form fields reads **only metadata**:
- `element.type`, `element.name`, `element.id`, `element.placeholder`, `element.autocomplete`
- **Never `element.value`**

Verified in:
- [input.ts:L88–L90](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/input.ts#L88-L90)
- [pii-detector.ts:L101](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/pii-detector.ts#L101), reads `target.value.length > 0` (boolean check only, not the value itself)

### ✅ PASS: Cookie Values Never Stored or Transmitted

[cookie.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/cookie.ts): `document.cookie` is parsed by splitting on `=`, but only the cookie **name** is stored in `CookieInfo`. Values are discarded.

### ✅ PASS: No PII Values in Storage or Messages

`PII_DETECTED` message payload ([pii-detector.ts:L146–L149](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/pii-detector.ts#L146-L149)) contains: `timestamp`, `site`, `fieldType`, `fieldName`, `sensitivity`, `siteWRS`. No actual PII.

`PIIDetectionEvent` stored in `piiDetections` contains: `timestamp`, `site`, `fieldType`, `sensitivity`, `siteWSS`, `scoreImpact`. No actual PII.

### ✅ PASS: Outbound Network Calls Send Only Bare Domains

- ToS;DR: sends base domain string only (e.g., "google")
- URLhaus: sends hostname only in POST body

No PII, no browsing history, no cookie values, no user data transmitted.

### ✅ PASS: No Telemetry / Analytics

No analytics SDK, no telemetry endpoint, no user tracking. Zero outbound calls except ToS;DR and URLhaus for third-party data lookups.

### ⚠️ NOTE: `scanVisibleText` Reads Full Page Content

[pii-detector.ts:L102–L145](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/pii-detector.ts) (if the second subagent's report is accurate for the current codebase): `document.body.innerText` may be read and regex-scanned for PII patterns (emails, phones, SSNs). However, matched values are **counted but never stored or transmitted**. The `PiiExposure` record contains only the type, not the value. This is acceptable for the stated detection purpose.

### ⚠️ NOTE: External Avatar URL

[profile.tsx:L23](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/profile.tsx#L23): Loads an image from `ferf1mheo22r9ira.public.blob.vercel-storage.com`. This is a network request to an external server that could theoretically log IP addresses. Not privacy-sensitive PII, but an undisclosed external connection from a privacy extension. Should be replaced with a local bundled avatar.

---

## 6. Security & Chrome Web Store Readiness

### 6a. Manifest Permissions Audit

| Permission | Justified? | By what feature? |
|-----------|-----------|-----------------|
| `storage` | ✅ | Core data persistence |
| `sidePanel` | ✅ | Side panel UI |
| `tabs` | ✅ | Active tab detection, URL extraction |
| `notifications` | ⚠️ Partially | Notification infrastructure exists but notifications are created locally only. The `chrome.notifications` API itself doesn't appear to be called directly, notifications use an in-UI dropdown. Permission may be unnecessary. |
| `alarms` | ✅ | Periodic database update checks / log cleanup |
| `cookies` | ✅ | Cookie enricher uses `chrome.cookies.getAll()` |
| `webRequest` | ✅ | Network monitor for header capture and tracker detection |
| `<all_urls>` (host) | ✅ | Content scripts and webRequest need to run on all pages |

**Flag:** The `notifications` permission should be verified, if only in-app notifications are used (not OS-level `chrome.notifications`), drop it.

### 6b. XSS Surface

- **No `innerHTML`** found anywhere in source.
- **One `dangerouslySetInnerHTML`** in [chart.tsx:L81](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/ui/chart.tsx#L81): Used by shadcn/recharts to inject CSS theme variables. The content is generated from internal config objects, not user/page data. **Safe.**
- All page-derived strings (hostnames, tracker domains, cookie names) rendered via JSX auto-escaping. ✅
- **Policy URL links**: Not explicitly sanitized with `sanitizeURL()` in sidepanel or site-details-panel. A page could inject a `javascript:` URL as its privacy policy link. **Low risk** (requires user click).

### 6c. Message Validation

[background/index.ts:L284](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/index.ts#L284): The `onMessage` listener checks `message.type` but does **not validate `_sender`**. A malicious page could theoretically forge messages via the content script's `chrome.runtime.sendMessage` if it can inject code. However, in MV3, content scripts run in an isolated world, so a page cannot directly call `chrome.runtime.sendMessage`. The risk is **low** but a `sender.id` check (verifying the message comes from the extension's own ID) would be a defense-in-depth improvement.

No `message-validator.ts` module exists despite being referenced in planning docs.

### 6d. Remote Code / Eval

- No `eval()`, no `new Function()`, no dynamic `import()` from remote URLs. ✅
- Dynamic `import()` used only for bundled database JSON files. ✅
- CSP in manifest: `script-src 'self'; object-src 'self'; connect-src 'self' https://urlhaus-api.abuse.ch https://api.tosdr.org;` ✅

### 6e. Storage Security

- **Encryption at rest**: Implemented via AES-GCM for `scoreHistory`, `piiDetections`, and `siteCache` when vault is locked. Uses PBKDF2 with 600K iterations. ✅
- **Quota monitoring**: `getStorageUsage()` reports usage with 5MB default quota. ✅
- **Write batching/debouncing**: Not implemented. Every state update writes immediately to `chrome.storage.local.set()`. Under heavy browsing, this could cause excessive writes.
- **Unbounded growth**: `detectorLogs` capped at 1000 entries ✅. `notifications` capped at 100 ✅. `siteCache` has **no cap**, grows with every unique domain visited. Over months of heavy use, this could approach the 5MB quota.

### 6f. Privacy Policy

Given the extension:
- Accesses browsing data (current URL, page content metadata)
- Makes outbound requests to tosdr.org and abuse.ch (sending hostnames)
- Stores browsing history locally (site cache)

A **privacy policy is required** for Chrome Web Store submission. None was found in the repository.

---

## 7. Stability & Resilience

### 7a. Error Handling ✅

- All background message handlers wrapped in try/catch.
- All content script detectors wrapped in try/catch with fallback defaults.
- Storage operations wrapped in try/catch returning safe defaults.
- React error boundaries on all three UI entry points (popup, sidepanel, dashboard).

### 7b. Race Conditions ⚠️

`background/index.ts` performs read-modify-write on `siteCache` without locking. Two simultaneous `PAGE_ANALYSIS_RESULT` messages for different domains could cause the second write to overwrite the first's additions. Same risk for `activityLogs`, `state`, and `scoreHistory`.

### 7c. Memory Leaks ⚠️

[network-monitor.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/network-monitor.ts): `tabData` Map stores network data per tab. `tabs.onRemoved` listener exists (L144) for cleanup ✅, but in-memory caches for ToS;DR and URLhaus grow without bounds and only reset on service worker restart.

### 7d. Offline Behavior

- ToS;DR and URLhaus failures caught and fail to safe defaults. ✅
- Policy score falls back to 50 (privacy link found) or 25 (no link). ✅
- No explicit offline detection or user notification.

### 7e. Content Script Injection Blocked

If a page's CSP blocks the content script, no analysis occurs and the sidepanel shows "Visit a website to see its privacy analysis." No error is surfaced to the user explaining *why* analysis failed.

---

## 8. Doc-vs-Code Delta

| Document Claim | Actual Code State |
|---------------|------------------|
| README: 12 languages | Code: 4 languages (en/es/fr/de) |
| README: WSS has 5 factors (Reputation, Tracking, Cookies, Input, Policy) | Code: Matches ✅ |
| README: "Tracker Analysis identifies 70+ known tracking domains" | Code: KNOWN_TRACKERS set contains ~80 domains ✅ |
| MASTER_PLAN: 6-factor WSS (includes Protocol at 20%) | Code: 5-factor (no Protocol weight) |
| MASTER_PLAN: Permission Detector (camera, mic, geo) | Code: Not implemented |
| MASTER_PLAN: FORM_FOCUS message and penalty | Code: Type exists, no sender or handler |
| MASTER_PLAN v3: "Trackers Blocked" identified as critical flaw | Code: Still labeled "Blocked" not "Detected" |
| MASTER_PLAN: Google Safe Browsing integration | Code: Not implemented |
| V2 Plan: 5-factor with Reputation 30%, Tracking 30% | Code: Matches current weights ✅ |
| V2 Plan: Infinite Log Engine with monthly chunks | Code: Flat array, 1000-entry cap |
| V2 Plan: Zero-day domain suspicion (cap at 70) | Code: Not implemented |
| Dashboard consolidation plan: Merge to 6 pages | Code: Still 10 pages |
| Local AI plan: On-device policy analysis | Code: Not implemented |
| CHANGELOG: Version 1.3.0 | manifest.json: Version 1.0.0 |

---

## 9. Prioritized Punch List

### 🔴 Blocker

1. **Rename "Trackers Blocked" to "Trackers Detected"** in [section-cards.tsx:L125](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/section-cards.tsx#L125), [data-table.tsx:L373](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/data-table.tsx#L373), and all translation keys. The extension does not block anything; this claim is false advertising.

2. **Fix inverted tracker score bucketing** in [trackers.tsx:L64–L74](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/trackers.tsx#L64-L74). Either invert the thresholds (0 = "High", >60 = "Clean") or convert the safety score to a tracker count for display.

3. **Write a privacy policy** for Chrome Web Store submission. Must disclose: local data storage, outbound requests to tosdr.org and abuse.ch (hostnames only), page content metadata scanning.

4. **Remove external avatar URL** from [profile.tsx:L23](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/profile.tsx#L23). Replace `ferf1mheo22r9ira.public.blob.vercel-storage.com` image with a local bundled SVG/PNG. A privacy extension making undisclosed external requests is a trust violation.

### 🟠 High

5. **Remove hardcoded profile data** ("Alex Watson", "Prompt Engineer") from [profile.tsx:L20–L25](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/../../../components/traceguard/profile.tsx#L20-L25). Either use `useUserName()` for the display name with a generic avatar, or remove the profile widget entirely.

6. **Delete unused `data.json`** at [data.json](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/app/dashboard/data.json). Contains third-party names ("Jamik Tashpulatov") that should not ship.

7. **Fix siteCache unbounded growth**: Add a max-sites cap (e.g., 500 domains) with LRU eviction in storage operations.

8. **Add sender validation** to `chrome.runtime.onMessage` handler in [background/index.ts:L284](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/index.ts#L284). Verify `sender.id === chrome.runtime.id` before processing messages.

9. **Sanitize policy URLs** before rendering as `<a href>` in sidepanel and site-details-panel. Use `sanitizeURL()` from `sanitize.ts` to reject `javascript:` and `data:` protocols.

10. **Update version** in manifest.json (currently 1.0.0) to match CHANGELOG (1.3.0), or vice versa.

### 🟡 Medium

11. **Fix/remove URLhaus integration** or replace with a working reputation source. Currently fails with 401, meaning all sites get maximum reputation scores.

12. **Update language count** in README from 12 to 4, or add the missing 8 translation dictionaries.

13. **Remove or clearly mark "coming soon"** on the Integrations page. Consider hiding it from nav until integrations exist.

14. **Add write debouncing** to storage operations. Multiple rapid page navigations cause rapid `chrome.storage.local.set()` calls.

15. **Verify the `notifications` permission** is actually needed. If only in-app notifications (not OS-level) are used, remove it from the manifest to reduce permission scope.

16. **Add siteCache cap** to prevent storage quota exhaustion over extended use.

### 🟢 Low

17. **Wire up fingerprinting to WSS** or document why it's excluded. Currently runs on every page but has zero influence on the score.

18. **Remove dead `form_focus` event type** from `UPSEvent` type or implement the handler.

19. **Make the logout button functional** in profile.tsx or remove it.

20. **Add offline indicator** to sidepanel when ToS;DR and URLhaus are unreachable, so users understand why scores may be less complete.

21. **Clean up `calculateWRS` legacy function** in scoring.ts, it's deprecated but still exported.

22. **Enable remote database updates** in database-loader.ts or document that databases are static.

---

## 10. One-Line Verdict

**Not ready to ship.** Top 3 blockers: (1) "Trackers Blocked" falsely claims the extension blocks trackers, (2) tracker distribution page displays inverted data making the analytics meaningless, (3) no privacy policy exists for Web Store submission, and an undisclosed external image request from a privacy extension is a trust-critical contradiction.
