# TraceGuard Pre-Release Audit (Revised)

*Revised with owner comments incorporated. Changes from v1 marked with* 🔄.

---

## 1. Architecture Map

### File Tree (source-only)
```
src/
├── background/
│   ├── index.ts                 ← Service worker (message router, scoring, UPS, storage)
│   ├── tosdr-api.ts             ← ToS;DR API client
│   └── services/
│       ├── cookie-enricher.ts   ← Cookie classification (local, uses chrome.cookies API)
│       ├── database-loader.ts   ← Tracker/FP database loader (bundled JSON, update disabled)
│       ├── header-analyzer.ts   ← HTTP header security grading
│       ├── network-monitor.ts   ← webRequest listener for headers/trackers
│       ├── reputation.ts        ← URLhaus + local blacklist checks
│       └── tracker-enricher.ts  ← Tracker categorization (local)
├── content/
│   ├── index.ts                 ← Entry point; orchestrates detectors, sends results
│   ├── analyzer.ts              ← Runs all detectors, builds score breakdown
│   ├── pii-detector.ts          ← Monitors input events for PII field types (NOT values)
│   └── detectors/
│       ├── cookie.ts            ← document.cookie parser + classifier
│       ├── fingerprinting.ts    ← Script/canvas/audio FP detection
│       ├── input.ts             ← Input field metadata scanner (type/name only)
│       ├── policy.ts            ← Privacy policy link finder + ToS;DR query
│       ├── reputation.ts        ← Sends hostname for reputation check
│       └── tracking.ts          ← Script/pixel/param tracker detection
├── lib/
│   ├── types.ts                 ← All interfaces
│   ├── scoring.ts               ← WSS formula (5-factor weighted sum, higher=safer)
│   ├── scoring.test.ts          ← Unit tests for scoring
│   ├── pii.ts                   ← UPS penalty/recovery math
│   ├── pii.test.ts              ← Unit tests for PII scoring
│   ├── storage.ts               ← StorageManager (chrome.storage.local wrapper)
│   ├── useStorage.ts            ← React hooks for reactive storage access
│   ├── risk-utils.ts            ← Color/label/grade helpers
│   ├── crypto.ts                ← AES-GCM encrypt/decrypt with PBKDF2
│   ├── sanitize.ts              ← DOMPurify-based HTML sanitizer
│   ├── rate-limiter.ts          ← Token-bucket rate limiter
│   ├── navigation.ts            ← Sidebar + search route definitions
│   ├── theme-utils.ts           ← Score→color mapping helpers
│   ├── i18n.ts / translations.ts ← 4 languages (en/es/fr/de)
│   └── utils.ts                 ← cn(), formatTimeAgo, etc.
├── popup/main.tsx               ← Popup entry
├── sidepanel/App.tsx + main.tsx  ← Main sidepanel UI
├── dashboard/App.tsx + main.tsx  ← Dashboard (HashRouter, 4 active routes)
├── components/
│   ├── traceguard/
│   │   ├── auth-provider.tsx    ← Vault encryption lock/unlock
│   │   ├── layout.tsx           ← Dashboard shell
│   │   ├── settings-modal.tsx   ← Settings dialog
│   │   ├── site-details-panel.tsx ← Detailed site analysis sheet
│   │   ├── notifications.tsx    ← In-app notification dropdown
│   │   ├── overview-tile.tsx    ← KPI tile component
│   │   ├── profile.tsx          ← ⚠️ DEAD CODE (not imported anywhere)
│   │   ├── search-command.tsx   ← Cmd+K command palette
│   │   ├── settings-context.tsx ← Settings modal state
│   │   └── pages/               ← 10 page files, only 4 routed
│   │       ├── overview.tsx     ← ✅ ROUTED
│   │       ├── privacy-score.tsx ← ✅ ROUTED
│   │       ├── rankings.tsx     ← ✅ ROUTED
│   │       ├── help.tsx         ← ✅ ROUTED
│   │       ├── activity-logs.tsx ← ❌ DEAD (no route)
│   │       ├── sites-analyzed.tsx ← ❌ DEAD (no route)
│   │       ├── sites-safety.tsx ← ❌ DEAD (no route)
│   │       ├── trackers.tsx     ← ❌ DEAD (no route)
│   │       ├── whitelist-blacklist.tsx ← ❌ DEAD (no route)
│   │       └── integrations.tsx ← ❌ DEAD (no route, owner: delete)
│   ├── section-cards.tsx        ← 6 KPI stat cards
│   ├── radial-chart-score.tsx   ← Radial UPS gauge
│   ├── data-table.tsx           ← Reusable data table + manual log entry
│   ├── chart-area-interactive.tsx ← UPS history area chart
│   ├── app-sidebar.tsx          ← Navigation sidebar (2 items: Overview, Rankings)
│   ├── nav-footer.tsx           ← Sidebar footer (user initials, lock, settings, language)
│   └── ErrorBoundary.tsx        ← React error boundary
├── app/dashboard/data.json      ← ⚠️ DEAD (unused mock data, owner: delete)
└── styles/globals.css
```

### Active Dashboard Routes vs Dead Pages

| Route | Component | Status |
|-------|-----------|--------|
| `/overview` | OverviewPage | ✅ Active |
| `/privacy-score` | PrivacyScorePage | ✅ Active |
| `/rankings` | RankingsPage | ✅ Active |
| `/help` | HelpPage | ✅ Active |
| `/activity-logs` | ActivityLogsPage | ❌ Dead — defined but not in router |
| `/sites-analyzed` | SitesAnalyzedPage | ❌ Dead |
| `/sites-safety` | SitesSafetyPage | ❌ Dead |
| `/trackers` | TrackersPage | ❌ Dead |
| `/whitelist-blacklist` | WhitelistBlacklistPage | ❌ Dead |
| `/integrations` | IntegrationsPage | ❌ Dead (owner: delete) |

> [!NOTE]
> `navigation.ts` still defines 10 routes and `search-command.tsx` indexes them all for Cmd+K search, but the router only has 4. Users could find pages in search that don't load.

### Scores & Metrics

| Metric | Range | Direction | Location |
|--------|-------|-----------|----------|
| **WSS** (Website Safety Score) | 0–100 | Higher = safer | [scoring.ts:L85–168](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.ts#L85-L168) |
| **UPS** (User Privacy Score) | 0–100 | Higher = better | [pii.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/pii.ts) |
| Tracking sub-score | 0–100 | Higher = fewer trackers | [tracking.ts:L237–240](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/tracking.ts#L237-L240) |
| Cookie sub-score | 0–100 | Higher = fewer cookies | [cookie.ts:L312–313](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/cookie.ts#L312-L313) |
| Input sub-score | 0–100 | Higher = fewer sensitive fields | [input.ts:L134–136](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/input.ts#L134-L136) |
| Policy sub-score | 0–100 | Higher = better ToS;DR grade | [policy.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/policy.ts) |
| Reputation sub-score | 0–100 | Higher = safer | [reputation.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/reputation.ts) |
| Fingerprinting score | 0–100 | Higher = more FP detected | [fingerprinting.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/fingerprinting.ts) — **not used in WSS** |

**WSS Weights:** Reputation 30% · Tracking 30% · Cookies 20% · Input 15% · Policy 5% · **Fingerprinting 0% (needs fix)**

### Outbound Network Calls (complete)

| Endpoint | Data Sent | Location |
|----------|-----------|----------|
| `https://api.tosdr.org/search/v4/?query={domain}` | Base domain only | [tosdr-api.ts:L138](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/tosdr-api.ts#L138) |
| `https://api.tosdr.org/service/v2/?id={id}` | ToS;DR service ID | [tosdr-api.ts:L189](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/tosdr-api.ts#L189) |
| `https://urlhaus-api.abuse.ch/v1/host/` | `{ host: hostname }` | [reputation.ts:L133](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/reputation.ts#L133) |
| `ferf1mheo22r9ira.public.blob.vercel-storage.com` | Avatar image request | [profile.tsx:L23](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/profile.tsx#L23) — **dead code, not loaded** |

🔄 The external avatar URL in `profile.tsx` is dead code — the file is not imported. The actual sidebar uses `AvatarFallback` (initials) with no external request. **Downgraded from Blocker.**

**No analytics, no telemetry, no user tracking.**

---

## 2. Working & Verified

- ✅ **WSS scoring formula**: 5-factor weighted sum with logarithmic sub-scores, `validateScore` guards against NaN/undefined/out-of-range, policy redistribution when unrated. [scoring.ts:L85–168](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.ts#L85-L168)
- ✅ **UPS penalty/recovery**: Penalty scales with site risk context; recovery only on safe site visits (WSS≥70); streak bonus. [pii.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/pii.ts)
- ✅ **All 6 content detectors** (cookie, tracking, fingerprinting, input, policy, reputation) run, produce results, and are individually fault-isolated via try/catch.
- ✅ **Input detectors never read `.value`**: Only metadata (type, name, id, placeholder, autocomplete). [input.ts:L88–90](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/detectors/input.ts#L88-L90)
- ✅ **PII detector**: Checks `target.value.length > 0` (boolean only, not value), sends field type and sensitivity to background. [pii-detector.ts:L101](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/pii-detector.ts#L101)
- ✅ **Score direction consistency**: All WSS sub-scores, `risk-utils.ts`, `theme-utils.ts`, and sidepanel UI agree: higher = better = green.
- ✅ **Vault encryption**: AES-GCM 256-bit / PBKDF2 (600K iterations), key in session storage, encrypts `scoreHistory`, `piiDetections`, `siteCache`. [crypto.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/crypto.ts), [auth-provider.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/auth-provider.tsx)
- ✅ **DOMPurify sanitization**: [sanitize.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/sanitize.ts) uses actual DOMPurify with explicit allow-lists.
- ✅ **Rate limiting**: Token-bucket for ToS;DR (10/min), URLhaus (5/min). [rate-limiter.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/rate-limiter.ts)
- ✅ **Storage retention**: Logs capped at 1000 entries + date-based cleanup. Notifications capped at 100.
- ✅ **Error boundaries**: All 3 UI entry points (popup, sidepanel, dashboard) wrapped.
- ✅ **Pre-unlock buffering**: Background buffers analysis data in `chrome.storage.session` before vault unlock, flushes on `UNLOCK_VAULT`.
- ✅ **Sidebar footer**: Uses `useUserName()` with fallback "User", initials avatar (no external URL), settings/language/lock actions.
- ✅ **Unit tests**: Scoring and PII penalty/recovery math covered. [scoring.test.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.test.ts), [pii.test.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/pii.test.ts)

---

## 3. Partially Implemented / Inconsistent

### 3a. "Trackers Blocked" — Misleading Attribution

🔄 **Owner clarification**: This stat is meant to track trackers blocked by the user's *browser or other extensions*, not by TraceGuard itself.

**Problem**: The value shown (`appState.trackersDetected`) at [section-cards.tsx:L27](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/section-cards.tsx#L27) is the count of trackers **detected** by TraceGuard's own tracking detector — not trackers blocked by other extensions. There is no mechanism to read block counts from uBlock Origin, Privacy Badger, or the browser's built-in blocker. The label and the data source are mismatched.

**To fix**: Either (a) rename to "Trackers Detected" to match what the data actually represents, or (b) implement reading block counts from other extensions (complex, may not be possible via Chrome APIs without cooperation from those extensions).

### 3b. Inverted Tracker Score Bucketing (Dead Page)

[trackers.tsx:L64–74](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/trackers.tsx#L64-L74) treats `breakdown.tracking` score 0 as "Clean" and >60 as "High." Since tracking score 0 = many trackers and >60 = few trackers, the labels are inverted.

🔄 **Mitigated by**: This page is **not routed** — it's dead code. If it's ever re-added, the bucketing must be fixed first.

### 3c. Hardcoded Reputation Placeholder

[analyzer.ts:L73](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/analyzer.ts#L73): `const reputationScore = 100` — the comment says the background will overwrite it. The background does replace this with the real reputation check result before computing WSS. However, if the reputation check fails or the URLhaus API is broken (which it currently is — see §4a), this `100` propagates as 30% of the WSS.

### 3d. Search Bar Missing & Navigation Config Has Dead Routes

The dashboard topbar is currently missing a search bar (needs to be implemented via shadcn). However, the underlying Cmd+K search palette component ([search-command.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/search-command.tsx)) indexes all 10 routes defined in [navigation.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/navigation.ts). The router ([dashboard/App.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/dashboard/App.tsx)) only supports 4 routes. Once the search bar is implemented, users will be able to search for and navigate to 6 dead pages that show a blank screen unless this is fixed.

### 3e. `enrichedDetails` Often Empty

The `enrichedDetails` field (cookie organizations, tracker prevalence, network request breakdown, header grades, fingerprinting details) requires the background enrichment pipeline to fully populate. Multiple dashboard columns show "—" fallbacks when this data is missing.

🔄 **Owner note**: Cookie organization detection needs reliability work.

---

## 4. Broken, Mock, or Missing

### 4a. URLhaus API — Requires API Key

🔄 **Researched per owner comment**: The URLhaus API (abuse.ch) **requires an Auth-Key** as of 2025. Keys are obtained free via [auth.abuse.ch](https://auth.abuse.ch) signup — **per-account, not per-project**. You cannot embed a single API key for all users.

**Options**:
1. **Remove URLhaus integration** and rely solely on the local blacklist for reputation. This is the simplest path.
2. **Have users provide their own key** via settings (add an API key field to settings-modal, store in local storage, pass in the request header). Adds friction but keeps the feature.
3. **Replace with a key-less API** — Google Safe Browsing v4 lookup API allows 10,000 free requests/day with a project API key embedded in the extension. This was listed in the MASTER_PLAN but never implemented.

Currently, all reputation checks via URLhaus silently fail to "safe" (score 100), meaning reputation contributes the maximum 30% to WSS for every site.

### 4b. Fingerprinting Not Used in WSS

🔄 **Owner directive**: Fingerprinting should have a meaningful impact on WSS.

The fingerprinting detector runs and produces `{ detected: boolean, techniques: string[], score: number }`, but `ScoreBreakdown` in [types.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/types.ts) has no `fingerprinting` field, and [scoring.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.ts) has no fingerprinting weight.

**Suggested approach**: Add a `fingerprinting` field to `ScoreBreakdown`. The sub-score formula could mirror tracking: `max(0, 100 - K * log2(weightedTechniques + 1))` with technique weights (canvas=5, WebGL=4, audio=3, font=2, navigator=1). Redistribute WSS weights to include it, e.g.: Reputation 25%, Tracking 25%, Cookies 15%, Fingerprinting 15%, Input 10%, Policy 10%.

### 4c. Database Remote Updates Disabled

🔄 **Owner directive**: Databases should refresh on install, then on industry-standard schedule (configurable in settings).

Currently: [database-loader.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/database-loader.ts) has remote update code commented out. The `alarms`-based update check runs but does nothing. Databases are bundled-only.

**Industry standard**: Tracker lists (EasyList, Disconnect) update every **4–7 days**. Recommended: default 7-day interval, configurable in settings (1/3/7/14/30 days).

### 4d. OS-Level Notifications Not Implemented

🔄 **Owner directive**: Needs OS-level `chrome.notifications` overlay, toggleable in settings.

Currently: The `notifications` permission is declared in manifest. The `NotificationEvent` type and in-app dropdown exist. But `chrome.notifications.create()` is never called anywhere. Notifications are purely in-dashboard.

### 4e. Dead Code to Clean Up

| File | Status | Action |
|------|--------|--------|
| [profile.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/profile.tsx) | Not imported anywhere | Delete |
| [integrations.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/integrations.tsx) | Not routed, owner says scrap | Delete |
| [data.json](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/app/dashboard/data.json) | Not referenced, mock data | Delete |
| [activity-logs.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/activity-logs.tsx) | Not routed | Delete or re-route |
| [sites-analyzed.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/sites-analyzed.tsx) | Not routed | Delete or re-route |
| [sites-safety.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/sites-safety.tsx) | Not routed | Delete or re-route |
| [trackers.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/trackers.tsx) | Not routed (has inverted scoring bug) | Delete or fix + re-route |
| [whitelist-blacklist.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/whitelist-blacklist.tsx) | Not routed | Delete or re-route |
| `form_focus` in [types.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/types.ts) | Type exists, no sender/handler | Remove from UPSEvent type |
| `calculateWRS` in [scoring.ts:L181–184](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.ts#L181-L184) | Deprecated alias | Remove |

---

## 5. Core Promise Integrity

> [!IMPORTANT]
> Central promise: **monitoring privacy without invading it.**

### ✅ PASS: No User Input Values Read

Every content-script detector reads **only metadata** — `element.type`, `element.name`, `element.id`, `element.placeholder`, `element.autocomplete`. Never `element.value`.

The PII detector checks `target.value.length > 0` at [pii-detector.ts:L101](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/content/pii-detector.ts#L101) — a boolean check, not a value read.

🔄 **Owner clarification on PII detection intent**: The extension detects that a website *requests* certain PII types, compares this against the site's WSS/reputation, and checks whether the user actually inputs data into those fields. It does **not** compare input content against a stored PII database. The current implementation matches this intent.

### ✅ PASS: No PII Values Stored or Transmitted

`PII_DETECTED` message payload: `{ timestamp, site, fieldType, fieldName, sensitivity, siteWRS }` — no actual PII.

### ✅ PASS: Outbound Calls Send Only Bare Domains

ToS;DR: base domain. URLhaus: hostname only. No PII, no browsing history, no cookie values.

### ✅ PASS: No Telemetry / Analytics

Zero analytics SDKs, zero telemetry endpoints, zero outbound calls except ToS;DR and URLhaus.

### ✅ PASS: No External Requests from Active Code

🔄 The external Vercel avatar URL in `profile.tsx` is **dead code** — not imported by any file. The active sidebar footer ([nav-footer.tsx:L67](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/nav-footer.tsx#L67)) uses `AvatarImage src=""` (empty, falls through to initials fallback). No undisclosed external requests in active code.

---

## 6. Security & Store Readiness

### Manifest Permissions

| Permission | Justified? | Notes |
|-----------|-----------|-------|
| `storage` | ✅ | Core data persistence |
| `sidePanel` | ✅ | Side panel UI |
| `tabs` | ✅ | Active tab detection |
| `notifications` | 🔄 ⚠️ **Keep** | Needed for planned OS-level notifications (owner confirms this feature is upcoming) |
| `alarms` | ✅ | Periodic cleanup + future database updates |
| `cookies` | ✅ | Cookie enricher uses `chrome.cookies.getAll()` |
| `webRequest` | ✅ | Network monitor for headers/trackers |
| `<all_urls>` | ✅ | Content scripts + webRequest on all pages |

### XSS Surface

- No `innerHTML` in source. ✅
- One `dangerouslySetInnerHTML` in [chart.tsx:L81](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/ui/chart.tsx#L81) — generates CSS theme vars from internal config. **Safe.**
- All page-derived strings rendered via JSX auto-escaping. ✅

🔄 **Yes, policy URLs should be sanitized.** A page could set its privacy policy link to `javascript:alert(1)`. When a user clicks the ToS;DR link in the sidepanel or site-details-panel, this could execute. Fix: pass the URL through `sanitizeURL()` from [sanitize.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/sanitize.ts) before rendering in `<a href>`.

### Message Validation

🔄 **Yes, implement `sender.id` validation.** At [background/index.ts:L284](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/index.ts#L284), add:
```typescript
if (sender.id !== chrome.runtime.id) {
    console.warn('[Security] Rejected message from unknown sender:', sender.id);
    return;
}
```
This is defense-in-depth. In MV3, content scripts run in an isolated world so a page can't directly forge messages, but validating the sender costs nothing and guards against edge cases.

### Remote Code / Eval

- No `eval()`, `new Function()`, or remote `import()`. ✅
- CSP in manifest is appropriately restrictive. ✅

### Storage

- Encryption at rest via AES-GCM for sensitive data. ✅
- `siteCache` has **no cap** — could grow unbounded. See punch list.
- No write debouncing. Every state update writes immediately.

### Privacy Policy

🔄 **Owner confirms: must be written.** Required for Chrome Web Store given the extension accesses browsing data, stores site history locally, and makes outbound requests to tosdr.org and abuse.ch.

---

## 7. Stability & Resilience

### Error Handling ✅
All layers (content detectors, background handlers, storage operations) have try/catch with safe defaults. Error boundaries on all UI roots.

### Race Conditions ⚠️ — Must Be Addressed

🔄 **Owner confirms this must be fixed.**

`background/index.ts` performs read-modify-write on `siteCache`, `activityLogs`, `state`, and `scoreHistory` without locking.

**Concrete fix — use a write queue:**
```typescript
// In background/index.ts
const writeQueue = new Map<string, Promise<void>>();

async function safeStorageUpdate<T>(key: string, updater: (current: T) => T): Promise<void> {
    const prev = writeQueue.get(key) || Promise.resolve();
    const next = prev.then(async () => {
        const result = await chrome.storage.local.get(key);
        const updated = updater(result[key]);
        await chrome.storage.local.set({ [key]: updated });
    });
    writeQueue.set(key, next);
    await next;
}
```
This serializes writes per key, preventing two concurrent updates from clobbering each other.

### Memory Leaks ⚠️

🔄 **Owner asked for suggestions:**

1. **ToS;DR cache** (in-memory Map in `tosdr-api.ts`): Add a max-entries cap. When size exceeds 200, evict the oldest 50 entries by timestamp. Example:
```typescript
if (cache.size > 200) {
    const sorted = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    sorted.slice(0, 50).forEach(([key]) => cache.delete(key));
}
```

2. **URLhaus cache** (session storage): Already stored in `chrome.storage.session` which has a 10MB quota and is cleared on browser restart. Add a TTL-based cleanup when reading: evict entries older than their TTL on read.

3. **`tabData` in network-monitor.ts**: Already has `tabs.onRemoved` cleanup. ✅ No action needed.

4. **General**: MV3 service workers are automatically terminated after ~5 minutes of inactivity, which clears all in-memory Maps. This is a natural leak mitigation. The main risk is during sustained heavy browsing sessions without idle periods.

### Offline Behavior
- ToS;DR / URLhaus failures fail to safe defaults. ✅
- No explicit offline indicator shown to user.

---

## 8. Doc-vs-Code Delta

🔄 **Owner note**: Documentation is old and doesn't reflect recent changes. Many changes are in git commit messages.

Key divergences (informational only — not a judgment):

| Area | Docs say | Code does |
|------|----------|-----------|
| Languages | 12 (README) | 4 (en/es/fr/de) — 🔄 owner: 4 is the target |
| WSS factors | 6 including Protocol (MASTER_PLAN) | 5 without Protocol |
| Dashboard pages | 10 (navigation.ts) | 4 active routes |
| Fingerprinting | Included in analysis | Runs but 0% WSS weight |
| Version | 1.3.0 (CHANGELOG) | 1.0.0 (manifest.json) |
| Tracker blocking | "Trackers Blocked" | Detection only |
| Database updates | Auto-refresh every 24h | Commented out |
| Permission detector | Planned (camera/mic/geo) | Not implemented |
| Google Safe Browsing | Planned | Not implemented |
| Local AI Integration | 🔄 Plan: Analyze UPS, stats, logs via local AI (Gemini Nano) | Not implemented |
| Policy Analysis (AI) | 🔄 Plan: 3rd party AI (opt-in) or local AI. Share to P2P DB. | Not implemented |
| Dashboard consolidation | 6-page plan | Not executed (still 10 files, 4 routes) |

---

## 9. Prioritized Punch List

### 🔴 Blocker (3)

**B1. Fix "Trackers Blocked" label and data source** — [section-cards.tsx:L125](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/section-cards.tsx#L125), [data-table.tsx:L373](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/data-table.tsx#L373)
- Either rename to "Trackers Detected" (matches current data), or implement a mechanism to read block counts from the browser/other extensions (complex). The current label is a false claim about functionality that doesn't exist.

**B2. Write a privacy policy** for Chrome Web Store
- Must disclose: local data storage of browsing metadata, outbound requests to tosdr.org (domains only) and abuse.ch (hostnames only), page content metadata scanning. Store it at a hosted URL and link from manifest or store listing.

**B3. Implement Search Bar and Sync Navigation Routes** — [navigation.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/navigation.ts), [search-command.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/search-command.tsx)
- The dashboard topbar needs the shadcn search bar implemented. Before exposing it, remove the 6 unrouted pages from `navigationItems` and `settingsSearchItems` so users don't search for and land on blank pages (e.g., "Activity Logs").

### 🟠 High (7)

**H1. Add fingerprinting to WSS formula** — [scoring.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/scoring.ts), [types.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/types.ts)
- Add `fingerprinting` to `ScoreBreakdown`. Implement logarithmic sub-score. Redistribute weights. Update tests.

**H2. Fix race conditions in background storage writes** — [background/index.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/index.ts)
- Implement a per-key write queue or use `chrome.storage.session` as a write lock. See §7 for concrete approach.

**H3. Resolve URLhaus integration** — [reputation.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/reputation.ts)
- Recommend: Remove URLhaus (requires per-user API key, not viable for a consumer extension). Replace with Google Safe Browsing Lookup API or strengthen the local blacklist instead. Until fixed, reputation is always 100 (30% of WSS is meaningless).

**H4. Delete dead code files** — `profile.tsx`, `integrations.tsx`, `data.json` (contains third-party names)
- These ship in the bundle for no reason. `data.json` has names like "Jamik Tashpulatov" that should not be in a published extension.

**H5. Sanitize policy URLs** in sidepanel and site-details-panel
- Pass through `sanitizeURL()` before rendering in `<a href>` to block `javascript:` protocol.

**H6. Add `sender.id` validation** to the `onMessage` handler at [background/index.ts:L284](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/index.ts#L284).

**H7. Add `siteCache` size cap** — Currently unbounded; grows with every unique domain. Add LRU eviction at e.g. 500 entries.

### 🟡 Medium (5)

**M1. Implement OS-level notifications** — Call `chrome.notifications.create()` for high-risk/PII events, controlled by existing settings toggles (`notifications.enabled`, `highRisk`, `piiExposure`).

**M2. Enable database remote updates** — Un-comment fetch URLs in [database-loader.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/background/services/database-loader.ts). Add a refresh interval setting (default 7 days). Hook into the existing `alarms` infrastructure.

**M3. Add write debouncing** — Multiple rapid navigations cause rapid `chrome.storage.local.set()`. Use `debounce()` from [utils.ts](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/lib/utils.ts) on storage writes with a 500ms delay.

**M4. Update version in manifest.json** from 1.0.0 to match actual release state.

**M5. Cap in-memory caches** — Add max-entries (200) to ToS;DR and URLhaus Maps to prevent memory growth during long sessions. See §7 for implementation.

### 🟢 Low (5)

**L1. Update README language count** from 12 to 4 (en/es/fr/de).

**L2. Decide on dead page files** — The 6 unrouted pages (activity-logs, sites-analyzed, sites-safety, trackers, whitelist-blacklist, integrations) are dead code. Either delete them to reduce bundle size or re-route them if they're intended to come back.

**L3. Remove `form_focus` from UPSEvent type** and `calculateWRS` deprecated alias from scoring.ts.

**L4. Add offline indicator** to sidepanel when external APIs are unreachable.

**L5. Update/consolidate planning docs** — Or add a note at the top of each doc saying "superseded by git commit history" to avoid confusion.

---

## 10. One-Line Verdict

**Not ready to ship.** Top 3 blockers: (1) "Trackers Blocked" falsely claims the extension tracks blocks it doesn't perform, (2) no privacy policy for Web Store submission, (3) Search bar UI is missing, and the underlying search component indexes 6 blank pages.
