# Dashboard Consolidation Plan

## Background

The TraceGuard dashboard currently has **10 separate pages** spread across the sidebar. After reading all of them, there are clear thematic overlaps and structural redundancies that make the navigation feel bloated for what is fundamentally a browser extension, a relatively compact tool.

---

## Redundancies Found

### 🔴 Critical Overlaps, Pages That Cover the Same Data

#### 1. `sites-analyzed.tsx` vs `website-safety.tsx`
Both pages show **the exact same data source** (`useSiteCache`) and both display:
- A "Total Sites" stat card
- A searchable list of every domain you've visited, each showing the WSS (Website Safety Score)
- Filtering/sorting by safety level

The **only differences** are cosmetic:
- `website-safety` shows expandable cards with a breakdown breakdown bar and a risk distribution chart
- `sites-analyzed` shows a flat list with visit count + a bar chart of top 10 most-visited sites

**Verdict:** These are the same page split in two. A user visiting one gains almost no additional value from visiting the other. → **Merge into one.**

#### 2. `trackers.tsx` vs `activity-logs.tsx`
Both pages use **the same underlying site data** (`useSiteCache`, `useDetectorLogs`) and both display per-site tracking information (the `breakdown.tracking` score). Specifically:
- `trackers` shows a ranked list of sites by tracking score + a pie chart of tracking intensity distribution
- `activity-logs` shows each visit with all 6 detector scores (including `tracking`) and expandable tracker details

A user looking for which sites track them most visits both pages and sees overlapping info. → **Merge tracker stats into activity logs as a tab or dedicated section.**

#### 3. `overview.tsx` duplicates content from 4 other pages
The Overview page is intentionally a summary, but it re-renders non-trivial UI that is nearly identical to content in other pages:
- **Privacy Score hero** → identical score circle + badge + sparkline shown again on `privacy-score.tsx`
- **"Website Safety" quick-view card** → shows avg WSS + trusted/blocked counts, duplicated from `website-safety.tsx` and `whitelist-blacklist.tsx`
- **"Recent Activity" notification card** → shows last 3 notifications, duplicated from `activity-logs.tsx`
- **4 stat cards** → "Sites Analyzed", "High Risk Sites", "PII Events", "Safe Streak" all recompute data that is already shown in full detail elsewhere

These duplication are **expected** for a summary page but the overview currently also has formatting + computation bugs (e.g. a trend fallback path that renders trend text instead of the sparkline). However, this is separate from the redundancy problem.

### 🟡 Moderate Overlaps, Pages That Share Structural DNA

#### 4. `whitelist-blacklist.tsx` has its own local `StatCard` component
This page defines a private `StatCard` function at the top (lines 57–85) that is almost identical to `@/components/ui/stat-card` (which all other pages already import). The only difference is it lacks `subtitle`, `href`, and `valueColor` props. → **Remove the local copy, use the shared one.**

#### 5. `settings.tsx` duplicates "About" info already in `help.tsx`
- `settings.tsx` has an "About" tab showing version, schema, and storage
- `help.tsx` has a "Version Info" card at the bottom showing the same "Local Only" badge + privacy commitment copy

→ **Move About content entirely into Settings, remove the version card from Help.**

#### 6. `activity-logs.tsx` has a local `getSafetyLevelLocal` that duplicates `getSafetyLevel` from `@/lib/risk-utils`
Line 174–180 defines `getSafetyLevelLocal` which maps WSS → level string. This is the same logic as `getSafetyLevel` in `@/lib/risk-utils` (already imported on line 55 but unused for this purpose). → **Replace local function with shared utility.**

#### 7. `activity-logs.tsx` has a local `getSafetyInfo` that duplicates `getSafetyConfig` from `@/lib/risk-utils`
Lines 183–189 define `getSafetyInfo` returning `{level, color, border}` objects. `getSafetyConfig` from `@/lib/risk-utils` provides this already. → **Replace with shared utility.**

### 🟢 Minor / Structural Redundancies

#### 8. Score/status threshold logic is scattered across multiple pages
The WSS color/label thresholds (`>= 80 → green`, `>= 60 → blue`, etc.) appear independently in:
- `sites-analyzed.tsx` → `getSafetyColor()` (local fn, lines 102–108)
- `activity-logs.tsx` → `getSafetyInfo()` + `getScoreColor()` (local fns)
- `website-safety.tsx` → via `safetyConfig` object (pulls from `SAFETY_CONFIGS`)
- `overview.tsx` → uses `getStatusConfig` from `@/lib/risk-utils`
- `help.tsx` → hardcoded color grids for "Understanding Scores"

The shared utilities in `@/lib/risk-utils` already exist to centralize this. Several pages just haven't been updated to use them consistently.

#### 9. `integrations.tsx` is a placeholder with no live data
The entire page is static marketing/roadmap content ("Coming Soon" / "Planned"). It adds a sidebar entry and a navigation item for zero user utility today. → **Move its content into the Help page as a "What's Coming" section and remove the dedicated route.**

---

## Proposed Consolidation Plan

### New Navigation Structure (from 10 pages → 6 pages)

| Current Pages | Proposed Page | Route |
|---|---|---|
| Overview | **Overview** (keep, light cleanup) | `/overview` |
| Privacy Score | **Privacy Score** (keep) | `/privacy-score` |
| Website Safety + Sites Analyzed | **Sites & Safety** (merged) | `/sites` |
| Trackers + Activity Logs | **Activity & Trackers** (merged with tabs) | `/activity` |
| Whitelist/Blacklist | **Domain Lists** (keep, minor cleanup) | `/domains` |
| Settings + Help + Integrations | **Settings** (absorbs About + Help + Integrations into new tabs) | `/settings` |

This reduces the sidebar from 10 items to 6, which is much more appropriate for a browser extension.

---

## Proposed Changes

### Part 1: Merge `website-safety` + `sites-analyzed` → `/sites`

#### [DELETE] [sites-analyzed.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/sites-analyzed.tsx)
#### [MODIFY] [website-safety.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/website-safety.tsx)
Rename to `sites-safety.tsx`. Add a tab bar with two tabs:
- **"Safety Analysis"**, existing website-safety content (risk distribution bar, expandable site cards sorted by risk)
- **"Visit History"**, existing sites-analyzed content (bar chart of most-visited, flat list with visit counts and last-visited dates)

Both tabs share the same search bar (filter applies to whichever tab is active) and the same stat row at the top (merge the two sets of 4 stat cards into a unified 5-card row: Total Sites, Avg Safety, At Risk, Safe, Today's Visits).

---

### Part 2: Merge `trackers` into `activity-logs` → `/activity`

#### [DELETE] [trackers.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/trackers.tsx)
#### [MODIFY] [activity-logs.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/activity-logs.tsx)
Add a tab bar with two tabs:
- **"Visit Logs"**, existing activity-logs content
- **"Trackers"**, existing trackers content (stat cards + pie chart + top-tracking sites list)

Also replace local `getSafetyLevelLocal` and `getSafetyInfo` with the shared `getSafetyLevel` / `getSafetyConfig` from `@/lib/risk-utils`.

---

### Part 3: Absorb `help` and `integrations` into `settings`

#### [DELETE] [integrations.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/integrations.tsx)
#### [DELETE] [help.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/help.tsx)
#### [MODIFY] [settings.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/settings.tsx)
Add two new tabs to the existing tab list:
- **"Help"**, migrate the Quick Start, Key Features, FAQ, and Understanding Scores sections from `help.tsx`
- **"Integrations"**, migrate the Coming Soon hero + planned integrations grid from `integrations.tsx`
- Move the "About" info from the existing `about` tab into the Help tab as a footer section. Remove the standalone About tab.

The Settings page already uses a tabs-based layout, making this a natural fit.

---

### Part 4: Fix `whitelist-blacklist.tsx` local StatCard

#### [MODIFY] [whitelist-blacklist.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/pages/whitelist-blacklist.tsx)
- Remove the local `StatCard` definition (lines 57–85)
- Import `StatCard` from `@/components/ui/stat-card`
- Add any missing props (`subtitle`) with sensible defaults for the two cards ("Trusted Domains" / "Blocked Domains")

---

### Part 5: Update routing and sidebar

#### [MODIFY] [App.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/dashboard/App.tsx)
- Update route for `/sites` to use the new merged sites-safety page
- Update route for `/activity` (rename from `/activity-logs`) to use the merged activity+trackers page
- Remove routes for `/trackers`, `/integrations`, `/help`
- Keep `/whitelist-blacklist` → consider renaming to `/domains` for clarity

#### [MODIFY] [sidebar.tsx](file:///home/luca/Documents/Github%20Projects/TraceGuard-Privacy-Extension/traceguard-extension/src/components/traceguard/sidebar.tsx)
- Remove "Trackers" nav item (merged into Activity)
- Remove "Integrations" nav item (moved into Settings)
- Remove "Help" from bottom nav (moved into Settings)
- Rename "Activity Logs" → "Activity & Trackers" pointing to `/activity`
- Rename "Sites Analyzed" → remove (merged into "Website Safety" → rename to "Sites & Safety")
- Keep "Settings" in bottom nav (now includes Help + Integrations tabs)

---

## Open Questions

> [!IMPORTANT]
> **Should Help stay accessible via keyboard shortcut or a `?` button in the top nav?** Moving it into Settings makes sense structurally, but Help discoverability could decrease for new users. One option: keep a Help link in the top-nav bar even after the dedicated page is removed.

> [!IMPORTANT]
> **Route naming: `/sites` vs `/website-safety`?** The Overview page has hardcoded `href="/sites"` and `href="/website-safety"` in separate places. The merge needs to pick one canonical route. Suggest `/sites` since it's shorter and already used in the overview's "Sites Analyzed" stat card.

> [!IMPORTANT]
> **Should `/activity-logs` redirect to `/activity`, or should the old route be kept for compatibility?** The popup and side panel may have hardlinks to `/activity-logs`. Worth checking before deleting.

## Verification Plan

### After Implementation
- All 6 sidebar routes load without errors
- Overview stat cards still link to correct merged pages
- Search filters work on both tabs in merged pages
- `whitelist-blacklist` uses shared `StatCard` with no visual regression
- No orphaned routes (old `/trackers`, `/integrations`, `/help` should 404 or redirect)

### Files to Check for Hardcoded Route References
- `overview.tsx`, links to `/website-safety`, `/activity-logs`, `/sites`, `/privacy-score`
- `sidebar.tsx`, all `href` values
- `app-sidebar.tsx`, if used, check its route references too
- Popup/sidepanel entry points in `src/popup/` and `src/sidepanel/`
