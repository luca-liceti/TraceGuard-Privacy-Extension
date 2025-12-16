# TraceGuard - Gap Analysis & Project Tracker

**Date:** December 9, 2025
**Status:** Phase 1.5: Scoring Refinement (Active)
**Next Step:** Session 6a: Standardize Detectors

---

## 📋 PROJECT DASHBOARD

### **Active Status**
- **Phase 1 (Core MVP):** ✅ Implementation Complete
- **Phase 1.5 (Scoring Overhaul):** 🚧 Active (New Priority from Revised Plan)
- **Phase 2 (UX):** ⬜ Scheduled
- **Phase 3 (Security):** ⬜ Scheduled
- **Phase 4 (Launch):** ⬜ Scheduled

---

## 🚧 ACTIVE & UPCOMING WORK

### **Phase 1.5: Scoring System Refinement**
**Goal:** Implement standardized 0-100 scoring, granular detection, and behavior-based UPS (no time decay).

#### Session 6a: Standardize Detectors (4-6 hours)
**AI Agent Tasks:**
- [ ] **Protocol Detector:** Update to return 0-100. Implement mixed content detection (Pure HTTPS=0, Mixed=40, HTTP=100).
- [ ] **Reputation Detector:** Maintain multi-layer check but standardize output to 0-100.
- [ ] **Tracking Detector:** Implement logarithmic scaling `min(100, 15 × log2(weightedCount + 1))`. Weights: Ad=5, Analytics=3, Unknown=1.
- [ ] **Cookie Detector:** Change to Standardized Scale (0=Safe). Implement logarithmic scaling. Weights: CrossSite=5, Analytics=3, ThirdParty=1.
- [ ] **Input Detector:** Implement PII type weighting (Critical=10, High=7, Medium=4, Low=2, Minimal=1). Use logarithmic formula `min(100, 12 × log2(weightedCount + 1))`.
- [ ] **Refactor:** Merge `src/content/pii-detector.ts` logic into standardized `src/content/detectors/input.ts`. Delete legacy `pii-detector.ts`.
- [ ] **Policy Detector:** Standardize ToS;DR mapping (A=0, B=20, C=50, D=75, E=100). Fallback=50, No Policy=75.

**Success Criteria:** All detectors return consistent 0-100 scores where 0 is safe and 100 is dangerous.

#### Session 6b: Behavior-Based UPS (3-4 hours)
**AI Agent Tasks:**
- [ ] **Remove Logic:** Remove all time-decay logic from background worker.
- [ ] **Site Visit Penalty:** Implement `penalty = (WRS / 100) * 10`. Max UPS deduction per visit.
- [ ] **PII Entry Penalty:** Implement `penalty = basePenalty * (1 + (WRS/100))`. Base: Critical=15, High=10, Medium=6, Low=3.
- [ ] **Safe Browsing Recovery:** Implement `recovery = (100 - WRS) / 50`. Add UPS on safe visits.
- [ ] **Feedback System:** Update UI messages to explain specific UPS changes ("Visited Risky Site: -5 UPS").
- [ ] **Update Background Worker:** Integrate new handler logic for page visits and PII events.

**Success Criteria:** UPS changes only based on user actions (visits/input), not time. Penalties are noticeable.

#### Session 6c: Validation & Logging Infrastructure (4-5 hours)
**AI Agent Tasks:**
- [ ] **Score Validation:** Create `validateDetectorScore(score)` to clamp 0-100 and handle NaNs.
- [ ] **Weight Validation:** Ensure WRS weights sum to exactly 1.0.
- [ ] **Debug Logger:** Create `src/lib/logger.ts` to replace `console.log`. Only log if `IS_DEBUG` (dev mode).
- [ ] **Debug Tools:** Add Dev Mode tool/button to force-set WRS (0, 50, 100) to safely test UPS penalties without visiting live malware sites.
- [ ] **Refactor Logging:** Replace all current console logs with `logger.debug()` tags (`[Cookie]`, `[WRS]`).
- [ ] **Error Boundaries:** Ensure calculation errors default to safe values (e.g., 50) rather than crashing.

**Success Criteria:** Robust error handling for scores, clean production console (no debug spam), strict type checking.

#### Session 6d: Validation Testing (Phase 5 of Revised Plan) (2-3 hours)
**Your Tasks:**
- [ ] **Test Manual Calculation:** Verify you can manually calculate WRS from the breakdown.
- [ ] **Test UPS Loss:** Visit high-risk sites and watch UPS drop immediately.
- [ ] **Test UPS Gain:** Visit safe sites and watch UPS recover.
- [ ] **Test PII Context:** Enter password on Safe site vs Risky site. Confirm penalty difference.
- [ ] **Check Logs:** Verify detailed logs appear in Dev Mode, but vanish in Production Mode.

---

### **Phase 2: Make It Usable (UX)**
**Goal:** Users can actually use the features

#### Session 7-8: Activity Logs (4-5 hours)
**AI Agent Tasks:**
- [ ] Create/update `src/components/traceguard/pages/activity-logs.tsx`
- [ ] **Display ALL detector events** - Protocol, Reputation, Tracking, Cookies, Inputs, Policy
- [ ] Display PII detection events from storage (field types only, NO values)
- [ ] Display site visit history from siteCache
- [ ] Add date filtering (today, week, month, all)
- [ ] Add site filtering (dropdown of visited sites)
- [ ] Add detector type filtering (filter by detector)
- [ ] Add export to CSV functionality
- [ ] **Sanitize all displayed data with DOMPurify**
- [ ] Style with shadcn components
- [ ] Run build and test

**Your Tasks:**
- [ ] Browse sites and enter PII
- [ ] Open activity logs, verify ALL detector events appear
- [ ] **Verify PII logs show field types only, NO actual values**
- [ ] Test filters work correctly (date, site, detector type)
- [ ] Export CSV, verify data is correct and sanitized
- [ ] Check timestamps are accurate

**Success Criteria:** Complete visibility into ALL detector activity, zero PII exposure, secure log display

#### Session 9-10: Whitelist/Blacklist Management (4-5 hours)
**AI Agent Tasks:**
- [ ] Create/update `src/components/traceguard/pages/whitelist-blacklist.tsx`
- [ ] Add domain input with **strict validation** (regex, format checking)
- [ ] Implement add/remove for whitelist
- [ ] Implement add/remove for blacklist
- [ ] Show current lists with delete buttons
- [ ] Make whitelist set WRS to 0 (trusted)
- [ ] Make blacklist set WRS to 100 (dangerous)
- [ ] Add bulk import (paste list of domains) with validation
- [ ] **Sanitize all domain inputs** - Prevent XSS and injection
- [ ] **Add confirmation dialog for bulk operations**
- [ ] Run build and test

**Your Tasks:**
- [ ] Add trusted domain to whitelist
- [ ] Visit that domain, verify WRS is 0
- [ ] Add domain to blacklist
- [ ] Visit that domain, verify WRS is 100
- [ ] Test bulk import with 10 domains
- [ ] Verify lists persist after reload
- [ ] **Test invalid domain rejection**

**Success Criteria:** Users can fully control trusted/blocked sites, robust input validation, secure domain management

#### Session 11: Polish Side Panel (3 hours)
**AI Agent Tasks:**
- [ ] Add loading spinner while analyzing site
- [ ] Add error state for analysis failures
- [ ] Add "Analyzing..." text during detection
- [ ] Improve visual feedback (animations, transitions)
- [ ] Add tooltips explaining UPS and WRS (with formulas)
- [ ] **Add real-time tab switching** - Update scores when user switches tabs
- [ ] Optimize for narrow widths (side panel constraint)
- [ ] **Ensure all displayed data is sanitized**
- [ ] Run build and test

**Your Tasks:**
- [ ] Open side panel, verify loading states appear
- [ ] Navigate between sites, check smooth transitions
- [ ] **Switch tabs rapidly, verify side panel updates correctly**
- [ ] Hover over tooltips, verify explanations are clear
- [ ] Test on different screen sizes

**Success Criteria:** Side panel feels polished and responsive, updates in real-time, secure data display

#### Session 12: Simple Onboarding + Telemetry Settings (3-4 hours)
**AI Agent Tasks:**
- [ ] Create `src/onboarding/index.html`
- [ ] Create `src/onboarding/Onboarding.tsx`
- [ ] Single page with 4 sections: What is UPS, What is WRS, How to use, Privacy & Telemetry
- [ ] **Add telemetry opt-in section** - Explain what data is collected (if any)
- [ ] **Telemetry OFF by default** - User must explicitly opt-in
- [ ] **Full transparency** - Show exactly what telemetry data is collected
- [ ] Add "Get Started" button that closes onboarding
- [ ] Add "Skip" button
- [ ] Update background worker to show onboarding on first install
- [ ] Set flag in storage to not show again
- [ ] **Add telemetry toggle to settings page**
- [ ] Style with shadcn components
- [ ] Run build and test

**Your Tasks:**
- [ ] Uninstall and reinstall extension
- [ ] Verify onboarding appears
- [ ] Read through content, verify it's clear
- [ ] **Verify telemetry is OFF by default**
- [ ] **Review telemetry transparency** - Ensure it's clear what's collected
- [ ] Click "Get Started", verify it doesn't show again
- [ ] Test "Skip" button works
- [ ] **Test telemetry toggle in settings**

**Success Criteria:** New users understand the extension immediately, telemetry is transparent and opt-in only, privacy-first approach

---

### **Phase 3: Make It Safe (Security)** 🔥 CRITICAL
**Goal:** Don't ship a privacy extension with security holes

#### Session 13: Add Basic Security + Message Validation (4-5 hours)
**AI Agent Tasks:**
- [ ] Install DOMPurify: `npm install dompurify @types/dompurify`
- [ ] Create `src/lib/sanitize.ts` with sanitization utilities
- [ ] **Create `src/lib/message-validator.ts`** - Schema validation for all message types
- [ ] **Add message validation to background worker** - Validate all incoming messages from content scripts
- [ ] **Add message validation to content scripts** - Validate all responses from background worker
- [ ] Add input validation for domain entries (regex validation)
- [ ] Wrap all chrome.storage calls in try-catch blocks
- [ ] Add error logging to `src/lib/error-logger.ts`
- [ ] Update whitelist/blacklist to use validation
- [ ] **Apply DOMPurify to all user-generated content** - Sanitize before rendering in dashboard
- [ ] Run build and test

**Your Tasks:**
- [ ] Try adding invalid domains (spaces, special chars)
- [ ] Verify validation rejects them
- [ ] Check error logs appear in console
- [ ] Verify no crashes when storage fails
- [ ] **Send malformed messages from content script** - Verify background worker rejects them
- [ ] **Test XSS attempts in dashboard** - Verify DOMPurify sanitizes content

**Success Criteria:** Extension handles invalid input gracefully, message validation working, XSS protection active

#### Session 14-15: Error Handling (4-5 hours)
**AI Agent Tasks:**
- [ ] Create `src/components/ErrorBoundary.tsx`
- [ ] Wrap all dashboard routes with ErrorBoundary
- [ ] Wrap side panel with ErrorBoundary
- [ ] Add loading states to all async operations
- [ ] Add error states (network errors, storage errors)
- [ ] Implement offline detection and graceful degradation
- [ ] Add fallback UI for missing data
- [ ] **Ensure error messages don't leak sensitive information**
- [ ] Run build and test

**Your Tasks:**
- [ ] Disconnect internet, verify extension still works
- [ ] Force an error (corrupt storage), verify error boundary catches it
- [ ] Verify loading states appear during data fetch
- [ ] Check error messages are user-friendly
- [ ] **Verify error messages don't expose internal details**

**Success Criteria:** Extension never shows blank screen or crashes, error messages are secure and user-friendly

#### Session 16: Storage Protection + Encryption + Backup (4-5 hours)
**AI Agent Tasks:**
- [ ] **Create `src/lib/backup.ts`** - Backup/restore utilities for user data
- [ ] **Implement pre-encryption backup** - Automatically backup all data before encryption migration
- [ ] **Add manual backup/export feature** - Allow users to download backup JSON file
- [ ] Implement basic AES-GCM encryption for sensitive data
- [ ] Create `src/lib/crypto.ts` with encrypt/decrypt functions
- [ ] Add storage write debouncing (500ms delay)
- [ ] Add storage quota monitoring
- [ ] Encrypt UPS, PII events, score history
- [ ] **Add encryption migration with rollback** - If encryption fails, restore from backup
- [ ] **Implement log retention policy:**
  - Logs persist indefinitely by default
  - Remove logs only when: storage quota exceeded, user-defined time limit reached, or manual clear
  - Add settings for log retention (7 days, 30 days, 90 days, forever)
  - Implement automatic cleanup when storage quota > 90%
- [ ] Run build and test

**Your Tasks:**
- [ ] **Test backup creation** - Verify backup file contains all data
- [ ] **Test backup restore** - Restore from backup, verify data intact
- [ ] Verify encrypted data in chrome.storage (inspect storage)
- [ ] Verify dashboard still displays decrypted data correctly
- [ ] Test rapid storage writes don't corrupt data
- [ ] Check storage quota warnings appear if needed
- [ ] **Test encryption migration** - Upgrade from unencrypted to encrypted
- [ ] **Test migration rollback** - Force encryption failure, verify rollback works
- [ ] **Test log retention** - Set 7-day limit, verify old logs deleted
- [ ] **Test manual log clear** - Clear logs, verify they're removed

**Success Criteria:** Sensitive data encrypted, backup/restore working, migration safe with rollback, log retention policy implemented, no data corruption

---

### **Phase 4: Make It Shippable (Launch)**
**Goal:** Ready for Chrome Web Store

#### Session 17-18: Testing + Performance + Cross-Browser (8-10 hours)
**Your Tasks (AI fixes bugs):**
- [ ] Test on 20+ real websites (news, social, shopping, banking)
- [ ] Test all user flows:
  - [ ] Install → Onboarding → Browse → Check scores
  - [ ] Add to whitelist → Verify override
  - [ ] Change settings → Verify persistence
  - [ ] View activity logs → Verify accuracy
  - [ ] Enter PII → Verify detection and UPS change
  - [ ] **Enable/disable telemetry → Verify behavior**
- [ ] Test edge cases:
  - [ ] Offline mode
  - [ ] Very long domain names
  - [ ] Sites with no forms
  - [ ] Sites with many trackers (100+ trackers)
  - [ ] **Rapid tab switching**
  - [ ] **Storage quota exceeded**
- [ ] **Performance Testing:**
  - [ ] Measure page load impact (should be < 50ms)
  - [ ] Test memory usage (should be < 50MB)
  - [ ] Test CPU usage during detection (should be minimal)
  - [ ] Verify no memory leaks (browse 50+ sites)
  - [ ] Test storage write performance (debouncing working)
  - [ ] Measure API rate limiting overhead
- [ ] **Cross-Browser Testing:**
  - [ ] Test in Google Chrome (primary target)
  - [ ] Test in Microsoft Edge (Chromium)
  - [ ] Test in Brave Browser (with Brave Shields)
  - [ ] Test in Opera (Chromium)
  - [ ] Verify all features work across browsers
  - [ ] Check for browser-specific bugs
- [ ] Document bugs in a list

**AI Agent Tasks:**
- [ ] Fix all critical bugs (crashes, data loss)
- [ ] Fix high-priority bugs (incorrect scores, UI issues)
- [ ] Add error handling for edge cases
- [ ] **Optimize performance if slow** - Reduce detection overhead
- [ ] **Fix cross-browser compatibility issues**
- [ ] Run build after each fix

**Success Criteria:** No critical bugs, extension works reliably, performance is acceptable, works across Chromium browsers

#### Session 19-20: Documentation (4-5 hours)
**AI Agent Tasks:**
- [ ] Write comprehensive README.md with:
  - [ ] What TraceGuard does
  - [ ] How to install (from Chrome Web Store)
  - [ ] How to use (screenshots)
  - [ ] **How calculation transparency works** - Explain console logging
  - [ ] FAQ section
  - [ ] Privacy policy link
- [ ] Create PRIVACY_POLICY.md with:
  - [ ] What data is collected (none sent to servers)
  - [ ] What data is stored locally
  - [ ] **Telemetry opt-in policy** - Explain what's collected if enabled
  - [ ] **Log retention policy** - Explain how logs are managed
  - [ ] User rights and data deletion
  - [ ] **Encryption and security measures**
- [ ] Write Chrome Web Store description (compelling copy)
- [ ] Create feature list for store listing
- [ ] **Document cross-browser compatibility**
- [ ] Write update notes

**Your Tasks:**
- [ ] Review README for clarity and accuracy
- [ ] Review privacy policy for completeness
- [ ] **Verify privacy policy covers all data practices**
- [ ] Review store description for appeal
- [ ] Take 5 high-quality screenshots:
  - [ ] Side panel showing scores
  - [ ] Dashboard overview
  - [ ] Activity logs (with ALL detector events)
  - [ ] Settings page (including telemetry toggle)
  - [ ] Whitelist management
- [ ] Edit screenshots to highlight key features

**Success Criteria:** Professional documentation ready for users, privacy policy is comprehensive and transparent

#### Session 21: Production Build + Final Security Audit (4-5 hours)
**AI Agent Tasks:**
- [ ] **Update console log strategy:**
  - [ ] **KEEP calculation transparency logs** - WRS, UPS, all detector calculations
  - [ ] **REMOVE debug logs** - Development-only console.log statements
  - [ ] **ADD debug mode toggle** - Allow users to enable verbose logging in settings
  - [ ] Tag all logs with prefixes: `[WRS]`, `[UPS]`, `[Cookie]`, etc.
- [ ] Optimize bundle size:
  - [ ] Remove unused dependencies
  - [ ] Enable tree-shaking
  - [ ] Minify code
- [ ] Update manifest.json with final details:
  - [ ] Proper description
  - [ ] Correct version (1.0.0)
  - [ ] All required permissions documented with justifications
  - [ ] **Add privacy policy URL**
- [ ] Run production build: `npm run build`
- [ ] Test production build in Chrome
- [ ] Create .zip file for submission
- [ ] Verify .zip structure is correct

**Your Tasks:**
- [ ] Load production build in Chrome
- [ ] Test all features work in production mode
- [ ] **Verify calculation logs still appear in console**
- [ ] **Verify debug logs are removed**
- [ ] Verify no console errors
- [ ] Check bundle size is reasonable (<5MB)
- [ ] Verify icons display correctly
- [ ] Test on a fresh Chrome profile (no dev tools)
- [ ] **Test in all supported browsers** (Chrome, Edge, Brave, Opera)

**Final Security Audit:**
- [ ] **Zero PII Storage:** Final verification - inspect all storage
- [ ] **Encryption:** Verify all sensitive data encrypted
- [ ] **Input Validation:** Test all user inputs one final time
- [ ] **XSS Protection:** Verify DOMPurify applied everywhere
- [ ] **Rate Limiting:** Verify all APIs rate-limited
- [ ] **Message Validation:** Test all message handlers
- [ ] **Telemetry:** Verify OFF by default, transparent when enabled
- [ ] **Permissions:** Verify only necessary permissions requested
- [ ] **Log Security:** Verify logs don't leak sensitive data
- [ ] **Backup Security:** Verify backups are encrypted

**Success Criteria:** Production-ready build that works perfectly, calculation transparency preserved, debug logs removed, passes final security audit

#### Session 22: Submit to Chrome Web Store + Post-Launch Plan (3-4 hours)
**Your Tasks (AI assists):**
- [ ] Create Chrome Web Store developer account ($5 fee)
- [ ] Upload .zip file
- [ ] Fill in store listing:
  - [ ] Name: TraceGuard Privacy Extension
  - [ ] Description: (from documentation)
  - [ ] Category: Privacy & Security
  - [ ] Upload screenshots
  - [ ] Upload icon (128x128)
  - [ ] Add privacy policy link
  - [ ] **Add support email**
  - [ ] **Justify all permissions** - Explain why each permission is needed
- [ ] Submit for review
- [ ] Wait for approval (1-3 days typically)

**AI Agent Tasks:**
- [ ] Help format store listing
- [ ] Review submission for completeness
- [ ] **Prepare response templates for common review feedback**
- [ ] Prepare response to any review feedback

**Rollback Plan (If Rejected):**
- [ ] **Common rejection reasons:**
  - Permissions not justified → Add detailed justifications
  - Privacy policy unclear → Revise privacy policy
  - Functionality doesn't match description → Update description
  - Security concerns → Address specific issues
- [ ] **Response strategy:**
  - Read rejection reason carefully
  - Address specific concerns
  - Resubmit within 24 hours
  - Keep backup of previous version
- [ ] **Escalation:** If rejected multiple times, seek help from Chrome Web Store support

**Post-Launch Monitoring Plan:**
- [ ] **Set up error monitoring** - Track extension errors in production
- [ ] **Monitor user reviews** - Respond to feedback within 48 hours
- [ ] **Track key metrics:**
  - Install count
  - Active users
  - Uninstall rate
  - Average rating
- [ ] **Plan v1.1 features** based on user feedback
- [ ] **Security monitoring** - Watch for reported vulnerabilities

**Success Criteria:** Extension submitted and pending review, rollback plan ready, post-launch monitoring in place

#### Session 23: CELEBRATE! 🎉
- [ ] Extension is live in Chrome Web Store
- [ ] Share with friends/family for initial feedback
- [ ] Monitor reviews and ratings
- [ ] **Respond to user feedback** - Be active in support
- [ ] **Monitor for crashes or errors** - Fix critical issues immediately
- [ ] Plan v1.1 features based on user feedback
- [ ] **Consider v1.5 integration** - uBlock Origin Lite + Privacy Badger integration

**Deliverable:** Extension live in Chrome Web Store with active monitoring and support

---

## 📚 TECHNICAL REFERENCE

### **Standardized Detector Scoring (0-100)**
**Philosophy:** 0 = Safe, 100 = Dangerous. Not binary, but granular.
**Levels:**
- 0-20: Safe (Green)
- 21-40: Low Risk (Blue)
- 41-60: Medium (Yellow)
- 61-80: High Risk (Orange)
- 81-100: Critical (Red)

### **Revised WRS Formula (v2.0)**
```javascript
WRS = (protocol × 0.25) + 
      (reputation × 0.25) + 
      (tracking × 0.20) + 
      (cookies × 0.15) + 
      (input × 0.10) + 
      (policy × 0.05)
```

**Implementation Details:**
- **Protocol:** Pure HTTPS=0, Mixed=40, HTTP=100.
- **Reputation:** Whitelist=0, Clean=0, Blacklist/SafeBrowsing=50, Both=100.
- **Tracking:** `min(100, 15 × log2(weightedCount + 1))`. Weights: Ad=5, Analytics=3, Unknown=1.
- **Cookies:** `min(100, 15 × log2(weightedCount + 1))`. Weights: Cross=5, Analytics=3, Third=1.
- **Input:** `min(100, 12 × log2(weightedCount + 1))`. Weights: Critical=10, High=7, Medium=4, Low=2.
- **Policy:** A=0, B=20, C=50, D=75, E=100, Fallback=50, None=75.

### **Behavior-Based UPS System (v2.0)**
**Core Rule:** NO time decay. Scores strictly change based on user actions.

**Penalties (UPS Loss):**
1. **Site Visit:** `penalty = (WRS / 100) * 10`
   - Example: Visit WRS 80 site → -8 UPS.
2. **PII Entry:** `penalty = basePenalty * (1 + (WRS/100))`
   - Base Penalties: Critical(15), High(10), Medium(6), Low(3).
   - Example: Password (15) on WRS 50 site (x1.5) = -23 UPS.

**Recovery (UPS Gain):**
1. **Safe Visit:** `recovery = (100 - WRS) / 50`
   - Example: Visit WRS 0 site → +2 UPS.

### **Notification System Design**
**CRITICAL RULE:** NO OS notifications. Use Sonner toast library only.

**When to Show Toasts:**
- ✅ High WRS detected (>70)
- ✅ PII entered on risky site (WRS >50)
- ✅ UPS drops significantly (>10 points)
- ✅ Settings saved successfully
- ❌ NOT on every page load (too annoying)
- ❌ NOT for low-risk events (WRS <30)

### **Validations**
- **Detector Output:** Must be 0-100. NaN defaults to 50.
- **Weights:** Must sum to 1.0.

---

## 🚫 DEFERRED / POST-MVP

### **What to Cut / Future Ideas**
**Defer to v1.1: Enhanced Detection & Extension Integration**
- ❌ **Enhanced Cookie Analysis** - Use `chrome.cookies` API for full cookie details (domain, SameSite, Secure, expiry)
- ❌ **Cookie Type Scoring** - Differentiate first-party vs third-party, session vs persistent
- ❌ **Export/Import** - Backup/restore settings and data
- ❌ **Advanced graphs/charts** - More detailed visualizations
- ❌ **Historical comparisons** - Compare privacy scores over time
- ❌ **Detailed analytics** - Deeper insights into browsing patterns
- ❌ **HTTPS Enforcement** - Auto-upgrade to HTTPS where available
- ❌ **Referrer Stripping** - Remove referrer headers for privacy

**Defer to v1.5: Privacy Ecosystem Integration**
- ❌ **uBlock Origin Lite Integration**
- ❌ **Privacy Badger Integration**
- ❌ **ToS;DR Extension Integration**
- ❌ **Unified Blocking Logic**

**Defer to v2.0: Advanced Privacy Features**
- ❌ **Data Broker Removal Assistant**
- ❌ **Multi-device sync**
- ❌ **Team features**
- ❌ **API for developers**
- ❌ **Cookie Management UI**
- ❌ **User-Agent Rotation**

---

## ✅ COMPLETED WORK (PHASE 1)

### Phase 1: Make It Work (Core MVP)
**Goal:** Extension actually functions end-to-end

#### Session 1: Reputation Detector + Multi-Layer System (3-4 hours) ✅ **COMPLETE**
**AI Agent Tasks:**
- [x] Created `src/content/detectors/reputation.ts` with domain checking logic
- [x] Integrated with existing blacklist service via messaging
- [x] Implemented multi-layer reputation system:
  - **Layer 1:** Local blacklist (instant, offline)
  - **Layer 2:** Google Safe Browsing API (built into Chrome, no API key needed)
  - **Layer 3:** PhishTank API (placeholder for future integration)
- [x] Added 5-minute caching to avoid repeated API calls
- [x] Return risk score 0-100 based on threat detection
- [x] Updated content script analyzer to call reputation detector (async)
- [x] Updated background message handler for reputation checks
- [x] Ran build and fixed all TypeScript errors

#### Session 1b: Cookie Detector Implementation (2-3 hours) ✅ **COMPLETE**
**AI Agent Tasks:**
- [x] Create `src/content/detectors/cookie.ts` with third-party cookie detection
- [x] Parse `document.cookie` to identify cross-site cookies
- [x] Detect cookies from different domains than current page
- [x] Return risk score 0-100 based on number of third-party cookies
- [x] **Add comprehensive console logging** - Show cookie types found, weighted calculation, score mapping
- [x] **Store detection logs** - Save cookie detection events to chrome.storage for dashboard display
- [x] Update content script analyzer to call cookie detector
- [x] Update WRS calculation to include cookies context at 15% weight
- [x] Run build and fix any TypeScript errors

#### Session 2-3: Connect Dashboard & Side Panel to Real Data (4-6 hours) ✅ **COMPLETE**
**AI Agent Tasks:**
- [x] Update `src/dashboard/App.tsx` to use `useAppState` hook
- [x] Connect all dashboard components to chrome.storage
- [x] Implement real-time storage listeners in dashboard
- [ ] **Connect side panel to chrome.storage with real-time updates** (Side panel already uses hooks)
- [ ] **Add tab change listener to side panel** - Update scores when switching tabs (Future enhancement)
- [x] Update activity logs page to display real PII events
- [x] **Update activity logs to display ALL detector logs** (cookie, tracking, reputation, policy, protocol, inputs)
- [ ] Update sites analyzed page to show real site cache (Already implemented)
- [ ] Add loading states to all components (Already implemented)
- [x] **Create log storage infrastructure** - Structured storage for all detector events
- [x] **Add log retention policy** - Only remove logs when storage full, user-defined time limit, or manual clear
- [x] Run build and fix errors

#### Session 3b: Enhance Tracking Detection with EFF Privacy Badger (2-3 hours) ✅ **COMPLETE**
**AI Agent Tasks:**
- [x] Research EFF Privacy Badger tracking list format and API/endpoint
- [x] Integrate comprehensive tracking domain list (70+ known trackers)
- [x] Update `src/content/detectors/tracking.ts` with known tracker list
- [x] Combine with existing third-party script detection
- [x] **Add comprehensive console logging** - Show trackers found, known vs suspicious, score calculation
- [x] **Store detection logs** - Save tracking detection events to chrome.storage for dashboard display ✅ **IMPLEMENTED**
- [x] Update WRS calculation to use 20% weight for tracking (already in formula)
- [x] Add fallback if detection fails (graceful error handling)
- [x] Run build and fix any TypeScript errors

#### Session 4: ToS;DR API Integration + Zero PII Storage + Rate Limiting (4-5 hours) ✅ **COMPLETE**
**AI Agent Tasks:**
- [x] Research ToS;DR open API endpoints (no API key required):
  - Service search: `https://api.tosdr.org/service/v1/`
  - Privacy shields: `https://shields.tosdr.org/<locale>_<service_id>.svg`
- [x] Create `src/background/tosdr-api.ts` with API integration:
  - Function to search for service by domain
  - Function to retrieve service rating/grade
  - Convert ToS;DR grade (A-F) to risk score (0-100)
  - A = 0, B = 20, C = 40, D = 60, E = 80, F = 100
  - **Add rate limiting** - Max 10 requests per minute, queue excess requests
- [x] Update `src/content/detectors/policy.ts` to use ToS;DR API:
  - Send message to background worker for ToS;DR lookup
  - Use service rating if available
  - Fallback to local red flag scanning if API unavailable
  - **Add comprehensive console logging** - Show ToS;DR grade, conversion to risk score, fallback usage
  - **Store detection logs** - Save policy detection events to chrome.storage for dashboard display ✅ **IMPLEMENTED**
- [x] Add 5-minute caching for ToS;DR API results (prevent excessive calls)
- [x] Add graceful fallback: if ToS;DR API fails, use local red flag detection
- [x] Update background message handler for CHECK_TOSDR requests
- [x] Update WRS calculation to use 5% weight for policy (new formula)
- [x] **Create `src/lib/rate-limiter.ts`** - Generic rate limiting utility for all API calls
- [x] **Apply rate limiting to:**
  - ToS;DR API (10 req/min)
  - Google Safe Browsing API (20 req/min)
  - EFF Privacy Badger list fetching (5 req/min)
- [x] **CRITICAL:** Audit all PII detector code to ensure zero storage
- [x] Remove any code storing actual PII values or hashes
- [x] Update PII detector to only store field types and metadata
- [x] **Add comprehensive console logging for PII detector** - Show field types detected, NOT values
- [x] **Store PII detection logs** - Save field type events (NOT values) to chrome.storage ✅ **IMPLEMENTED**
- [x] Verify field-type detection only (monitor input types, not values)
- [x] Run build and fix errors

#### Session 4b: Fix Settings Persistence (2-3 hours) ✅ **COMPLETE**
**AI Agent Tasks:**
- [x] Update settings page to read from chrome.storage (Already implemented)
- [x] Implement save functionality with validation (Already implemented)
- [x] **Add input validation** - Sanitize all user inputs before storage
- [x] Make notification toggle affect background worker behavior
- [x] Make threshold settings affect WRS warnings
- [x] Add success/error messages on save (using Sonner toasts) ✅ **IMPLEMENTED**
- [x] Run build and test

#### Session 5: Update WRS Formula + UPS Decay/Recovery + Complete Logging (4-5 hours) ✅ **COMPLETE**
**AI Agent Tasks:**
- [x] Update WRS calculation to use new 6-context weights:
  - protocol: 0.25, reputation: 0.25, tracking: 0.20, cookies: 0.15, inputs: 0.10, policy: 0.05
- [x] **Add comprehensive console logging for WRS calculation** - Show each context score, weight, contribution, and final weighted sum
- [x] **Add comprehensive console logging for Protocol Detector** - Show HTTP/HTTPS detection, score calculation
- [x] **Add comprehensive console logging for Reputation Detector** - Show blacklist check, Safe Browsing result, score calculation
- [x] **Add comprehensive console logging for Input Detector** - Show field types detected, risk assessment, score calculation
- [x] **Store ALL detector logs** - Ensure protocol, reputation, and input detection events saved to chrome.storage ✅ **IMPLEMENTED**
- [x] Implement clear decay formula for UPS (e.g., exponential decay over time) ✅ **IMPLEMENTED: UPS = UPS_prev × (0.95 ^ hours)**
- [x] **Add comprehensive console logging for UPS decay** - Show previous score, time elapsed, decay factor, calculation steps
- [x] Document decay formula mathematically (UPS = UPS_prev * decay_factor ^ time_elapsed)
- [x] Implement recovery mechanism (UPS can increase when visiting safe sites) ✅ **IMPLEMENTED: +2 points per hour on safe sites**
- [x] **Add comprehensive console logging for UPS recovery** - Show recovery calculation steps
- [x] Create recovery formula (inverse of decay, caps at original max)
- [x] Add transparency: Show decay/recovery formulas in UI or settings (Documented in code)
- [x] Update all scoring calculations to use new weights
- [x] **Ensure ALL calculations log step-by-step breakdowns to console**
- [x] **Verify ALL detector logs display in dashboard activity logs** ✅ **IMPLEMENTED**
- [x] Run build and fix errors

#### Session 6b: Implement Sonner Notifications (2-3 hours) ✅ **COMPLETE**
**AI Agent Tasks:**
- [x] Install Sonner: `npm install sonner` ✅ **INSTALLED**
- [x] Add `<Toaster />` component to dashboard root (`src/dashboard/App.tsx`) ✅ **IMPLEMENTED**
- [ ] Add `<Toaster />` component to side panel root (`src/sidepanel/SidePanel.tsx`) (Future enhancement)
- [x] Create `src/lib/notifications.ts` with notification utilities: (Implemented inline in settings page)
  - Function for high WRS warnings (toast.error)
  - Function for PII detection alerts (toast.warning)
  - Function for UPS changes (toast.info)
  - Function for settings saved (toast.success) ✅ **IMPLEMENTED**
- [ ] Integrate notifications in background worker: (Future enhancement)
  - Send notification when WRS > 70
  - Send notification when PII entered on risky site (WRS > 50)
  - Send notification when UPS drops > 10 points
- [x] Add notification settings to settings page: (Already exists)
  - Toggle for notifications (on/off)
  - Threshold slider for WRS warnings (default: 70)
  - Toggle for PII alerts (on/off)
- [x] Configure Sonner with proper styling:
  - Position: top-right ✅
  - Duration: 4000ms ✅
  - Rich colors enabled ✅
  - Close button enabled ✅
- [x] Run build and test
