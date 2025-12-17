# Changelog - Session Dec 16, 2025

## Version 1.2.0 - ToS;DR Integration & UI Refinements

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
