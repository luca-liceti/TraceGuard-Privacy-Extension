# Changelog

## Version 1.3.0 - Dashboard Redesign & Testing Infrastructure (Dec 17, 2025)

### ✨ New Features

#### Testing Infrastructure
- **Added Vitest** - Full unit testing framework with happy-dom environment
- **Chrome API mocks** - Comprehensive mocking for `chrome.storage`, `chrome.runtime`, etc.
- **Scoring tests** - Unit tests for WSS calculation covering all edge cases
- **PII tests** - Unit tests for penalty/recovery logic and integration scenarios

#### Navigation System
- **Centralized navigation config** - Single source of truth in `lib/navigation.ts`
- **Synced sidebar & search** - Adding a new page now auto-updates both sidebar and command palette

### 🎨 UI/UX Improvements

#### Dashboard Redesign
- **Redesigned all core pages** - Overview, Privacy Score, Website Safety, Sites Analyzed, Trackers, Whitelist/Blacklist, Activity Logs, Settings, Help
- **shadcn/ui sidebar-07** - Refactored to use official sidebar block for consistency
- **New theme system** - oklch color variables for modern, vibrant design
- **Clickable stat cards** - Cards now link to their relevant detail pages

#### Settings Page
- **Complete overhaul** - Grouped settings by category (Display, Privacy, Data, Reset)
- **Display mode selector** - Choose between popup, sidebar, or both
- **Notification confirmations** - Toast notifications on setting changes

### 🔧 Improvements

- **Fixed display mode sync** - Settings now correctly reflect active display mode
- **Breadcrumb accuracy** - Updated to show correct page hierarchy
- **README.md** - Professional readme with badges, architecture, and getting started guide
- **package.json metadata** - Added description, keywords, author, and correct license

### 📦 Project Polish

- **Added LICENSE** - AGPL-3.0
- **Added CHANGELOG.md** - Version history tracking
- **Added docs/** - Logos and screenshots for documentation
- **Updated .gitignore** - Comprehensive exclusions for build artifacts and dev files

---

## Version 1.2.0 - ToS;DR Integration & UI Refinements (Dec 16, 2025)

### 🔧 Bug Fixes

#### ToS;DR API Integration (Privacy Policy)
- **Fixed ToS;DR API not working** - Changed from dynamic import to static import (service workers don't support dynamic imports properly)
- **Fixed domain extraction for brand TLDs** - `antigravity.google` now correctly searches as `google` in ToS;DR
- **Fixed rating parsing** - Now correctly handles rating object `{letter, human}` from API v4
- **Added proper caching** - 5-minute TTL for ToS;DR results

#### Policy Score in WSS
- **Fixed policy fallback behavior** - When ToS;DR doesn't have a rating, the 5% weight is redistributed to other metrics instead of penalizing the site
- **Fallback scores** - 50 (has local policy link) or 25 (no link) are now properly excluded from WSS

#### Reputation System
- **Simplified content detector** - Removed redundant Safe Browsing check from content script
- **Fixed CHECK_REPUTATION handler** - Now properly handles both `message.url` and `message.domain`
- **Added null checks** - Prevents "checking undefined" errors

### 🎨 UI/UX Improvements

#### Sidepanel Detection Details
- **Tracking**: Shows trackers found, known trackers, suspicious count
- **Cookies**: Shows total cookies, tracking cookies, third-party cookies
- **Input Fields**: Shows total fields, sensitive (HIGH) count, field types
- **Policy**: Shows ToS;DR Grade (A-E or "Not rated"), Source (ToS;DR API or Local detection)
- **Reputation**: Shows status (Clean/Blacklisted/Suspicious), checked sources

#### Auto-Update
- Added storage listener for `siteCache` changes - sidepanel now auto-updates when new analysis data is available

### 🏗️ Code Quality

- Removed unused `calculateUPS` re-export from `scoring.ts`
- Cleaned up console logging for better debugging
- Added `detectionDetails` field to `SiteRiskData` type

### ⚠️ Known Issues

- **URLhaus API returns 401** - Their API may be rate-limiting or having issues. Fails gracefully to "safe"
- **"window is not defined" error** - Non-blocking error in background, extension functions normally

### 📊 ToS;DR Grades Now Working

| Site | Grade | Score |
|------|-------|-------|
| github.com | B | 80 |
| google.com | E | 20 |
| youtube.com | E | 20 |
| cnn.com | E | 20 |
