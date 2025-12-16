# Project Critique & Corrective Action Plan

**Date:** December 8, 2025
**Reviewer:** Senior Developer / AI Lead
**Status:** Critical Review

---

## 1. Executive Summary & Critique

The project has made significant progress in establishing the core infrastructure (Manifest V3, React Dashboard, detailed WRS/UPS scoring). However, there are **critical discrepancies** between the "Completed" status claimed in the Gap Analysis and the actual code implementation. Several features marked as "Done" are either non-functional placeholders or violate explicit architectural rules defined in the plan.

### 🚨 Critical Gaps & Violations (The "Fix It" List)

#### 1. PhishTank Detection is a Placeholder (Deceptive Status)
*   **Claim:** "Layer 3: PhishTank API... [x] Implemented multi-layer reputation system... [x] Return risk score 0-100".
*   **Reality:** `checkPhishTankAPI` in `background/index.ts` is hardcoded to `return false` (safe). There is no API integration, no logic, and no value provided. It is effectively "Not Implemented".
*   **Impact:** The "Multi-layer" reputation system is actually just a local blacklist + Google Safe Browsing (if available).

#### 2. Whitelist/Blacklist UI is Disconnected from Backend
*   **Claim:** "Whitelist/Blacklist Management" features are being built.
*   **Reality:** The UI (`whitelist-blacklist.tsx`) successfully saves domains to `chrome.storage`. However, the detection logic (`checkReputation` in `services/reputation.ts`) **only** checks a static `blacklist.json`. It completely ignores the user's custom whitelist/blacklist.
*   **Impact:** Users can add domains to the list, but it will have zero effect on their privacy score or protection.

#### 3. Notification Architecture Violation
*   **Claim:** "CRITICAL RULE: NO OS notifications. Use Sonner toast library only... ❌ NO OS Notifications - Never use `chrome.notifications` API".
*   **Reality:** `background/index.ts` explicitly calls `chrome.notifications.create` for PII detection events.
*   **Impact:** This violates the design specifications and creates inconsistent UX (system notifications mixed with in-app toasts).

#### 4. Google Safe Browsing Rate Limiting Missing
*   **Claim:** "[x] Apply rate limiting to: ... Google Safe Browsing API (20 req/min)".
*   **Reality:** `rateLimiters` are defined in `lib/rate-limiter.ts`, but the `checkSafeBrowsing` function in `background/index.ts` calls `chrome.safeBrowsing` directly without using the rate limiter wrapper.
*   **Impact:** Potential for API quota exhaustion if the user visits many pages quickly.

---

## 2. Corrective Action Plan (The New Plan)

This plan overrides previous "Next Steps" to prioritize fixing the broken/fake implementations.

### Phase 1: Integrity & Core Functionality Fixes (Immediate Priority)

#### Step 1: Implement Real Whitelist/Blacklist Logic
**Objective:** Connect the UI to the backend so user settings actually work.
**Tasks:**
- [ ] Modify `background/services/reputation.ts` to read `whitelist` and `blacklist` from `chrome.storage.local` alongside the static list.
- [ ] Update `calculateWRS` (or the reputation detector) to implement the **Override Rule**:
    - If **Whitelisted**: Force WRS to 0 (Safe) immediately, bypassing other checks.
    - If **Blacklisted**: Force WRS to 100 (Critical) immediately.

#### Step 2: Honest PhishTank Implementation
**Objective:** Remove deceptive code.
**Decision:** Since PhishTank requires an API key which we cannot bundle safely for a public extension without a proxy server, we must **downgrade** this feature.
**Tasks:**
- [ ] Remove "Layer 3: PhishTank" from the active detection logic.
- [ ] Update the relevant UI logs to not claim it is being checked.
- [ ] Convert it to a "Future Roadmap" item or replace it with a local heuristic check if possible. *Do not ship fake code.*

#### Step 3: Fix Messaging & Notifications
**Objective:** Adhere to "No OS Notifications" rule.
**Tasks:**
- [ ] Remove `chrome.notifications.create` from `background/index.ts`.
- [ ] Implement a messaging system: Background sends a `SHOW_TOAST` message to the active tab's content script.
- [ ] Update Content Script to listen for `SHOW_TOAST` and trigger a Sonner toast in the DOM overlay.

#### Step 4: Enforce Rate Limits
**Objective:** Protect API quotas.
**Tasks:**
- [ ] Refactor `background/index.ts` message handlers to wrap the `chrome.safeBrowsing` call inside `rateLimiters.safeBrowsing.execute()`.

### Phase 2: Security & Hardening (As originally planned, but verified)
- [ ] **Input Validation:** Sanitize all inputs in `whitelist-blacklist.tsx` (verify regex).
- [ ] **Message Validation:** Implement `src/lib/message-validator.ts` to ensure content scripts cannot trigger arbitrary background actions.

---

## 3. Final Verdict

The project is **80% complete**, not 95% as previous checklists suggested. The core works, but the "Advanced" features (custom lists, multi-layer rep, strict UI rules) are currently partially broken or faked.

**Recommendation:** Halt new feature development (like onboarding) until Phase 1 fixes are deployed and verified.
