# TraceGuard - Master Implementation Plan

**Date:** December 16, 2025  
**Version:** 3.0 (Revised Scoring Philosophy)  
**Status:** Phase 1.5: Critical Fixes + Dashboard Redesign (Active)  
**Next Step:** Session 7: Core Logic Fixes

---

## 📋 PROJECT DASHBOARD

### **Active Status**
- **Phase 1 (Core MVP):** ✅ Implementation Complete
- **Phase 1.5 (Critical Fixes):** 🚧 **ACTIVE** - Scoring overhaul + Dashboard redesign
- **Phase 2 (UX Polish):** ⬜ Scheduled
- **Phase 3 (Security):** ⬜ Scheduled
- **Phase 4 (Launch):** ⬜ Scheduled

### **Critical Issues Identified (Dec 16, 2025)**
> [!CAUTION]
> The following fundamental issues were discovered during code review and must be fixed before proceeding:

| Issue | Severity | Status |
|-------|----------|--------|
| Scoring direction inconsistency | 🔴 Critical | ⬜ TODO |
| "Trackers Blocked" displays but never incremented | 🔴 Critical | ⬜ TODO |
| "Data Breaches" shows hardcoded mock data | 🔴 Critical | ⬜ TODO |
| UPS penalty ignores site context | 🟠 High | ⬜ TODO |
| Logarithmic formulas not implemented | 🟠 High | ⬜ TODO |
| Window global state anti-pattern in sidebar | 🟡 Medium | ⬜ TODO |
| 50ms polling interval inefficiency | 🟡 Medium | ⬜ TODO |

---

## 📚 TECHNICAL REFERENCE (REVISED v3.0)

### **Scoring Philosophy - UPDATED**

> [!IMPORTANT]
> **All metrics now follow "Higher = Better" convention for user clarity.**

| Metric | Range | Direction | Meaning |
|--------|-------|-----------|---------|
| **UPS** (User Privacy Score) | 0-100 | Higher = Better | 100 = fully protected |
| **WSS** (Website Safety Score) | 0-100 | Higher = Better | 100 = completely safe |
| **Detector Safety Scores** | 0-100 | Higher = Better | 100 = no risk detected |

**Visual Mapping:**
- 80-100: Safe (Green) ✅
- 60-79: Low Risk (Blue) 🔵
- 40-59: Medium (Yellow) 🟡
- 20-39: High Risk (Orange) 🟠
- 0-19: Critical (Red) 🔴

---

### **WSS Formula (v3.0) - Renamed from WRS**

```javascript
WSS = (protocol × 0.25) + 
      (reputation × 0.25) + 
      (tracking × 0.20) + 
      (cookies × 0.15) + 
      (input × 0.10) + 
      (policy × 0.05)
```

**Detector Implementations (All return Safety Scores: 100=safe, 0=dangerous):**

#### Protocol Detector
```javascript
if (protocol === 'https:' && !hasMixedContent) return 100;  // Pure HTTPS
if (protocol === 'https:' && hasMixedContent) return 60;     // Mixed content
return 0;  // HTTP
```

#### Reputation Detector
```javascript
if (isWhitelisted) return 100;
if (isClean) return 100;
if (isSafeBrowsingThreat) return 10;
if (isBlacklisted) return 0;
return 100;  // Unknown defaults to safe
```

#### Tracking Detector (Logarithmic)
```javascript
// Weights: Known=5, Suspicious=2, CDN=1
const K = 15;
safetyScore = Math.max(0, 100 - (K * Math.log2(weightedCount + 1)));
```

#### Cookie Detector (Logarithmic)
```javascript
// Weights: CrossSite=5, Analytics=3, ThirdParty=1
const K = 12;
safetyScore = Math.max(0, 100 - (K * Math.log2(weightedCount + 1)));
```

#### Input Detector (Logarithmic)
```javascript
// Weights: Password/SSN=10, CreditCard=8, Email/Phone=5, Address=3, Name=1
const K = 10;
safetyScore = Math.max(0, 100 - (K * Math.log2(weightedCount + 1)));
```

#### Policy Detector
```javascript
gradeMap = { A: 100, B: 80, C: 60, D: 30, E: 10, F: 0 };
if (noPolicy) return 25;
if (unknown) return 50;
```

#### Permission Detector (NEW)
```javascript
// Weights: camera=25, microphone=25, geolocation=20, clipboard=15, notifications=10
const K = 8;
safetyScore = Math.max(0, 100 - (K * Math.log2(weightedCount + 1)));
```

---

### **UPS Penalty & Recovery System (v3.0)**

**Core Rule:** NO time decay. Scores change based on user actions only.

#### Site Visit Penalty
```javascript
function calculateVisitPenalty(siteWSS: number): number {
  return ((100 - siteWSS) / 100) * 2;
}
// WSS 100 → 0 penalty, WSS 0 → 2 penalty
```

#### PII Entry Penalty (Granular)
```javascript
const basePenalties = {
  password: 8,
  ssn: 10,
  creditCard: 9,
  email: 4,
  phone: 5,
  address: 3,
  name: 1
};

const contextMultiplier = 1 + ((100 - siteWSS) / 100);
penalty = basePenalties[fieldType] * contextMultiplier;
// Password on WSS 100 → 8, Password on WSS 0 → 16
```

#### Form Focus Penalty (Intent Tracking)
```javascript
// 20% of base penalty when user focuses on sensitive field
focusPenalty = basePenalties[fieldType] * 0.2 * contextMultiplier;
```

#### Recovery Formula
```javascript
function calculateRecovery(siteWSS: number, safeStreak: number): number {
  if (siteWSS < 70) return 0;  // No recovery from risky sites
  
  let recovery = ((siteWSS - 70) / 30) * 0.5;
  
  // Streak bonus every 10 consecutive safe sites
  if (safeStreak > 0 && safeStreak % 10 === 0) {
    recovery += 2;
  }
  
  return recovery;
}
// WSS 100 → 0.5 recovery, WSS 85 → 0.25 recovery
```

---

### **Calculation Log Format**

```
[2025-12-16 20:05:32] WSS Calculation for example.com
├── Protocol: HTTPS (pure) → 100
├── Reputation: Clean → 100
├── Tracking: 8 weighted (2 known×5 + 1 suspicious×2)
│   └── Formula: max(0, 100 - 15×log2(9)) = 52.6
├── Cookies: 12 weighted
│   └── Formula: max(0, 100 - 12×log2(13)) = 55.6
├── Inputs: 5 weighted (1 password field)
│   └── Formula: max(0, 100 - 10×log2(6)) = 74.2
├── Policy: ToS;DR Grade B → 80
├── Weighted Sum: 100×0.25 + 100×0.25 + 52.6×0.20 + 55.6×0.15 + 74.2×0.10 + 80×0.05
│   └── = 25 + 25 + 10.52 + 8.34 + 7.42 + 4 = 80.28
└── Final WSS: 80 (rounded)
```

---

## 🚧 ACTIVE & UPCOMING WORK

### **Phase 1.5: Critical Fixes + Dashboard Redesign**

#### Session 7: Core Logic Fixes (5-6 hours)

**A. Scoring Direction & Rename (WRS → WSS)**

- [ ] Rename `calculateWRS` → `calculateWSS` in `src/lib/scoring.ts`
- [ ] Update all `wrs` → `wss` in `src/lib/types.ts` interfaces
- [ ] Add score validation: clamp 0-100, handle NaN with `validateScore()`
- [ ] Update `src/background/index.ts` - rename all WRS references
- [ ] Update `src/sidepanel/App.tsx` - fix inverted color logic
- [ ] Update all dashboard pages with WSS terminology

**B. Logarithmic Detector Formulas**

- [ ] Update `src/content/detectors/protocol.ts` - add mixed content detection
- [ ] Update `src/content/detectors/tracking.ts` - implement `max(0, 100 - 15×log2(weighted+1))`
- [ ] Update `src/content/detectors/cookie.ts` - implement `max(0, 100 - 12×log2(weighted+1))`
- [ ] Update `src/content/detectors/input.ts` - implement `max(0, 100 - 10×log2(weighted+1))`
- [ ] Update `src/content/detectors/policy.ts` - update ToS;DR mapping (A=100, B=80, C=60, D=30, E=10)
- [ ] Create `src/content/detectors/permissions.ts` - NEW detector

**C. UPS System Overhaul**

- [ ] Rewrite `src/lib/pii.ts` with granular penalties
- [ ] Implement site visit penalty formula
- [ ] Implement recovery formula
- [ ] Add form focus tracking

**Success Criteria:** All detectors return consistent 0-100 safety scores, WSS calculates correctly, UPS responds to user actions.

---

#### Session 8: New MVP Features (3-4 hours)

**A. Permission Detection**

- [ ] Create `src/content/detectors/permissions.ts`
- [ ] Detect Permissions API requests (geolocation, camera, microphone, notifications, clipboard)
- [ ] Add to analyzer and WSS calculation
- [ ] Add message handler in background worker

**B. Form Focus Tracking**

- [ ] Add focus event listeners in content script
- [ ] Send `FORM_FOCUS` message on input focus
- [ ] Handle in background worker with smaller penalty
- [ ] Log to activity logs

**C. Cross-Site Exposure Tracking**

- [ ] Add `crossSiteExposure` to `StorageSchema` in types.ts
- [ ] Add `addExposure()`, `getExposureCount()`, `getExposureSites()` to storage.ts
- [ ] Track which sites have received each PII type
- [ ] Create dashboard display component

**Success Criteria:** Permission requests detected, form focus tracked, cross-site exposure tracked.

---

#### Session 9: Dashboard Redesign - Setup (2-3 hours)

**A. Proper shadcn Initialization**

- [ ] Run `npx shadcn@latest init` (New York style, Neutral colors)
- [ ] Add components: `card button sidebar navigation-menu tabs table badge progress chart avatar dropdown-menu separator scroll-area tooltip`
- [ ] Verify Tailwind configuration

**B. Remove Anti-Patterns**

- [ ] Create `src/context/SidebarContext.tsx` - proper React Context
- [ ] Remove window global state from `sidebar.tsx`
- [ ] Remove `next-themes` import (wrong library for Vite)
- [ ] Remove 50ms polling interval

**Success Criteria:** Clean component system, no window globals, proper React patterns.

---

#### Session 10: Dashboard Redesign - Content (4-5 hours)

**A. Main Dashboard (`content.tsx`)**

- [ ] Redesign header with UPS prominently displayed
- [ ] Create Privacy Score card (with gauge visualization)
- [ ] Create Sites Analyzed card
- [ ] Rename "Trackers Blocked" → "Trackers Detected" (fix misleading metric)
- [ ] **REMOVE** "Data Breaches" card (mock data)
- [ ] **ADD** Cross-Site Exposure card (new feature)
- [ ] Add UPS trend chart
- [ ] Add WSS distribution chart

**B. Sidepanel Redesign (`sidepanel/App.tsx`)**

- [ ] Rename WRS → WSS throughout
- [ ] Fix color logic (currently inverted: high=green should be correct after WSS rename)
- [ ] Add WSS breakdown with mini progress bars
- [ ] Add cross-site exposure summary
- [ ] Link cards to relevant dashboard pages

**C. New Page: Cross-Site Exposure (`pages/cross-site-exposure.tsx`)**

- [ ] Create page component
- [ ] Show table: PII type → list of sites
- [ ] Add visualization: "Your email is known to X sites"
- [ ] Add route to App.tsx and sidebar

**Success Criteria:** Dashboard displays accurate data, no fake metrics, new cross-site exposure feature visible.

---

#### Session 11: Activity Logs & Polishing (3-4 hours)

**A. Activity Logs Enhancement**

- [ ] Add tree-structured calculation logs
- [ ] Show full formula breakdowns
- [ ] Add filter by detector type
- [ ] Add search functionality

**B. Storage Migration**

- [ ] Create `src/lib/migration.ts`
- [ ] Migrate `wrs` → `wss` in stored data
- [ ] Initialize `crossSiteExposure` structure
- [ ] Handle schema version bump

**C. Testing & Validation**

- [ ] Test all detectors return 0-100 safety scores
- [ ] Test WSS calculation matches formula
- [ ] Test UPS penalties apply correctly
- [ ] Test recovery formula works
- [ ] Test cross-site exposure tracking
- [ ] Build and fix errors

**Success Criteria:** Activity logs show detailed calculations, storage migrated, all tests pass.

---

### **Phase 2: Make It Usable (UX Polish)**

#### Session 12-13: Activity Logs & Filtering (4-5 hours)
- [ ] Add date filtering (today, week, month, all)
- [ ] Add site filtering (dropdown of visited sites)
- [ ] Add detector type filtering
- [ ] Add export to CSV functionality
- [ ] **Sanitize all displayed data with DOMPurify**
- [ ] Style with shadcn components

#### Session 14-15: Whitelist/Blacklist Management (4-5 hours)
- [ ] Add domain input with **strict validation**
- [ ] Implement add/remove for whitelist
- [ ] Implement add/remove for blacklist
- [ ] Make whitelist set WSS to 100 (trusted)
- [ ] Make blacklist set WSS to 0 (dangerous)
- [ ] Add bulk import with validation
- [ ] **Sanitize all domain inputs**

#### Session 16: Polish Side Panel & Popup (3 hours)
- [ ] Add loading spinner while analyzing
- [ ] Add error state for analysis failures
- [ ] Improve visual feedback (animations)
- [ ] Add tooltips explaining UPS and WSS
- [ ] Optimize for narrow widths

#### Session 17: Onboarding + Telemetry Settings (3-4 hours)
- [ ] Create `src/onboarding/index.html` and `Onboarding.tsx`
- [ ] Sections: What is UPS, What is WSS, How to use, Privacy
- [ ] Telemetry OFF by default, opt-in only
- [ ] "Get Started" and "Skip" buttons
- [ ] Show on first install

---

### **Phase 3: Make It Safe (Security)**

#### Session 18: Basic Security + Validation (4-5 hours)
- [ ] Install DOMPurify
- [ ] Create `src/lib/sanitize.ts`
- [ ] Create `src/lib/message-validator.ts`
- [ ] Add validation to background worker and content scripts
- [ ] Wrap chrome.storage calls in try-catch

#### Session 19-20: Error Handling (4-5 hours)
- [ ] Create/update `src/components/ErrorBoundary.tsx`
- [ ] Wrap all routes with ErrorBoundary
- [ ] Add loading/error states to async operations
- [ ] Implement offline detection

#### Session 21: Storage Protection + Encryption (4-5 hours)
- [ ] Create `src/lib/backup.ts` - backup/restore utilities
- [ ] Implement AES-GCM encryption for sensitive data
- [ ] Add storage write debouncing
- [ ] Add storage quota monitoring

---

### **Phase 4: Make It Shippable (Launch)**

#### Session 22-23: Testing + Performance (8-10 hours)
- [ ] Test on 20+ real websites
- [ ] Test all user flows
- [ ] Performance testing (page load impact < 50ms)
- [ ] Cross-browser testing (Chrome, Edge, Brave, Opera)

#### Session 24-25: Documentation (4-5 hours)
- [ ] Write comprehensive README.md
- [ ] Create PRIVACY_POLICY.md
- [ ] Write Chrome Web Store description
- [ ] Create feature list

#### Session 26: Production Build + Security Audit (4-5 hours)
- [ ] Tag calculation logs with prefixes: `[WSS]`, `[UPS]`, `[Cookie]`, etc.
- [ ] Remove debug logs
- [ ] Optimize bundle size
- [ ] Update manifest.json
- [ ] Final security audit

#### Session 27: Submit to Chrome Web Store (3-4 hours)
- [ ] Create developer account
- [ ] Upload and fill store listing
- [ ] Submit for review

---

## 🚫 DEFERRED / POST-MVP

### **v1.1: Enhanced Detection**
- Session Duration Weighting (time-based exposure)
- Domain Age Check (WHOIS integration)
- Redirect Chain Analysis
- Download Risk Assessment
- Privacy Recommendations Engine
- Enhanced Cookie Analysis (chrome.cookies API)
- HTTPS Enforcement
- Referrer Stripping

### **v1.5: Privacy Ecosystem Integration**
- uBlock Origin Lite Integration (enables "Trackers Blocked" metric)
- Privacy Badger Integration
- ToS;DR Extension Integration
- Unified Blocking Logic

### **v2.0: Advanced Features**
- Data Broker Removal Assistant
- Multi-device sync
- Historical trends / month-over-month
- Comparative benchmarks
- Privacy goals

---

## ✅ COMPLETED WORK (PHASE 1)

### Phase 1: Core MVP ✅ COMPLETE

#### Session 1: Reputation Detector + Multi-Layer System ✅
- [x] Created `src/content/detectors/reputation.ts`
- [x] Implemented multi-layer system: Local blacklist + Google Safe Browsing
- [x] Added 5-minute caching
- [x] Return risk score 0-100

#### Session 1b: Cookie Detector ✅
- [x] Created `src/content/detectors/cookie.ts`
- [x] Parse `document.cookie` for third-party cookies
- [x] Weighted scoring for cookie types
- [x] Console logging + storage

#### Session 2-3: Dashboard & Side Panel Connection ✅
- [x] Connected dashboard to chrome.storage
- [x] Real-time storage listeners
- [x] Activity logs display detector events
- [x] Log storage infrastructure

#### Session 3b: Tracking Detection with EFF Privacy Badger ✅
- [x] 70+ known tracker domains
- [x] Combine with third-party script detection
- [x] Console logging + storage

#### Session 4: ToS;DR API + Rate Limiting ✅
- [x] ToS;DR API integration
- [x] Rate limiting (10 req/min)
- [x] 5-minute caching
- [x] Graceful fallback
- [x] Zero PII storage verified

#### Session 4b: Settings Persistence ✅
- [x] Settings read/write from chrome.storage
- [x] Input validation
- [x] Sonner toast notifications

#### Session 5: WRS Formula + UPS Decay/Recovery ✅
- [x] 6-context weighted formula
- [x] Comprehensive console logging
- [x] All detector logs stored
- [x] UPS decay implemented (legacy - to be replaced)
- [x] Recovery mechanism (legacy - to be replaced)

#### Session 6b: Sonner Notifications ✅
- [x] Installed and configured Sonner
- [x] Added to dashboard root
- [x] Toast styling configured

---

## 📝 NOTES

### Key File Locations
- Scoring: `src/lib/scoring.ts`
- Storage: `src/lib/storage.ts`
- Types: `src/lib/types.ts`
- UPS Logic: `src/lib/pii.ts`
- Background: `src/background/index.ts`
- Detectors: `src/content/detectors/*.ts`
- Dashboard: `src/dashboard/App.tsx`, `src/components/traceguard/*`
- Sidepanel: `src/sidepanel/App.tsx`

### shadcn Setup Commands
```bash
cd traceguard-extension
npx shadcn@latest init
# Select: New York, Neutral, CSS variables
npx shadcn@latest add card button sidebar navigation-menu tabs table badge progress avatar dropdown-menu separator scroll-area tooltip
```
