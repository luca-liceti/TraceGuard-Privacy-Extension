# 🎯 Revised UPS & WRS Implementation Plan

**Date:** December 9, 2025  
**Status:** ACTIONABLE - Ready for Implementation  
**Philosophy:** Behavior-based scoring, not time-based punishment

---

## 🧭 CORE PRINCIPLES

### 1. **Standardized Scoring (0-100)**
- **ALL detectors** use the same scale: **0 = safe, 100 = dangerous**
- Users can manually calculate WRS: `(protocol×0.25 + reputation×0.25 + tracking×0.20 + cookies×0.15 + input×0.10 + policy×0.05)`
- Simple, transparent, predictable

### 2. **Granular, Weighted Detection**
- **Not binary** - Many steps between safe and dangerous
- **Type matters** - Different cookies/trackers/PIIs have different weights
- **Amount matters** - More violations = higher score
- **Combination matters** - Multiple factors compound risk

### 3. **Behavior-Based UPS (No Time Decay)**
- **Penalize risky visits** - Lose UPS when visiting high-WRS sites
- **Penalize harmful content** - Lose UPS for trackers, cookies, bad policies
- **Reward safe behavior** - Gain UPS when visiting low-WRS sites
- **NO time decay** - Your score doesn't drop for doing nothing

### 4. **Noticeable but Recoverable Penalties**
- Penalties are **significant** - Users notice and want to change behavior
- Recovery is **achievable** - With safe browsing, users can recover confidence
- Balance: **Educational, not punitive**

---

## 📊 STANDARDIZED SCORING SYSTEM

### All Detectors Use: 0 = Safe, 100 = Dangerous

```
SCORE RANGE    | LEVEL      | COLOR  | USER MESSAGE
---------------|------------|--------|----------------------------------
0-20           | Safe       | Green  | "Excellent privacy protection"
21-40          | Low Risk   | Blue   | "Minor privacy concerns"
41-60          | Medium     | Yellow | "Moderate privacy risk"
61-80          | High Risk  | Orange | "Significant privacy concerns"
81-100         | Critical   | Red    | "Critical privacy threat"
```

### WRS Calculation (Unchanged)
```javascript
WRS = (protocol × 0.25) + 
      (reputation × 0.25) + 
      (tracking × 0.20) + 
      (cookies × 0.15) + 
      (input × 0.10) + 
      (policy × 0.05)

// All inputs are 0-100, output is 0-100
// User can calculate this manually from the breakdown
```

---

## 🔧 DETECTOR IMPLEMENTATIONS

### 1. Protocol Detector (0-100)

**Current:** Binary (0 or 100)  
**Revised:** Add mixed content detection

```typescript
export function detectProtocol(): number {
    const protocol = window.location.protocol;
    
    // HTTPS = 0 (safe)
    if (protocol === 'https:') {
        // Check for mixed content
        const hasMixedContent = detectMixedContent();
        if (hasMixedContent) {
            return 40; // HTTPS but loading HTTP resources
        }
        return 0; // Pure HTTPS
    }
    
    // HTTP = 100 (dangerous)
    return 100;
}

function detectMixedContent(): boolean {
    // Check for HTTP resources on HTTPS page
    const scripts = document.getElementsByTagName('script');
    const images = document.getElementsByTagName('img');
    const stylesheets = document.getElementsByTagName('link');
    
    const checkUrl = (url: string) => url.startsWith('http://');
    
    for (const script of scripts) {
        if (script.src && checkUrl(script.src)) return true;
    }
    for (const img of images) {
        if (img.src && checkUrl(img.src)) return true;
    }
    for (const link of stylesheets) {
        if (link.href && checkUrl(link.href)) return true;
    }
    
    return false;
}
```

**Score Examples:**
- Pure HTTPS → 0
- HTTPS with mixed content → 40
- HTTP → 100

---

### 2. Reputation Detector (0-100)

**Current:** Binary (0 or 100)  
**Revised:** Multi-layer with weighted scoring

```typescript
export async function detectReputation(url: string): Promise<number> {
    let score = 0;
    
    // Layer 1: Local blacklist (50 points if found)
    const isBlacklisted = await checkLocalBlacklist(url);
    if (isBlacklisted) {
        score += 50;
    }
    
    // Layer 2: Google Safe Browsing (50 points if threat found)
    const safeBrowsingThreat = await checkSafeBrowsing(url);
    if (safeBrowsingThreat) {
        score += 50;
    }
    
    // Layer 3: User whitelist (overrides everything)
    const isWhitelisted = await checkUserWhitelist(url);
    if (isWhitelisted) {
        return 0; // User trusts this domain
    }
    
    // Clamp to 0-100
    return Math.min(100, score);
}
```

**Score Examples:**
- Whitelisted → 0
- Clean → 0
- Blacklisted only → 50
- Safe Browsing threat only → 50
- Both blacklist + threat → 100

---

### 3. Tracking Detector (0-100)

**Current:** Fixed breakpoints (0, 20, 40, 60, 80, 100)  
**Revised:** Granular, weighted, logarithmic scaling

```typescript
interface TrackerWeights {
    adTrackers: 5;        // Google Ads, DoubleClick, Facebook Pixel
    analyticsTrackers: 3; // Google Analytics, Mixpanel, Segment
    unknownTrackers: 1;   // Suspicious third-party domains
}

export function detectTracking(): number {
    const trackers = scanForTrackers();
    
    // Calculate weighted tracker count
    const weightedCount = 
        (trackers.adTrackers.length * 5) +
        (trackers.analyticsTrackers.length * 3) +
        (trackers.unknownTrackers.length * 1);
    
    // Logarithmic scaling for smooth granularity
    // Formula: score = min(100, 15 × log₂(weightedCount + 1))
    //
    // Examples:
    // 0 trackers → 0
    // 1 analytics (3 weighted) → 30
    // 2 analytics (6 weighted) → 42
    // 1 ad tracker (5 weighted) → 37
    // 2 ad + 2 analytics (16 weighted) → 60
    // 5 ad + 5 analytics (40 weighted) → 77
    // 10 ad + 10 analytics (80 weighted) → 92
    
    if (weightedCount === 0) return 0;
    
    const score = Math.min(100, Math.round(15 * Math.log2(weightedCount + 1)));
    
    console.log('[Tracking] Weighted calculation:', {
        counts: {
            adTrackers: trackers.adTrackers.length,
            analyticsTrackers: trackers.analyticsTrackers.length,
            unknownTrackers: trackers.unknownTrackers.length
        },
        weightedCount,
        formula: `min(100, 15 × log₂(${weightedCount} + 1))`,
        score
    });
    
    return score;
}
```

**Score Examples:**
- 0 trackers → 0 (safe)
- 1 Google Analytics → 30 (low risk)
- 1 Facebook Pixel → 37 (low-medium risk)
- 2 ad trackers + 2 analytics → 60 (medium risk)
- 5 ad trackers + 5 analytics → 77 (high risk)
- 10+ ad trackers → 90+ (critical risk)

---

### 4. Cookie Detector (0-100)

**Current:** Inverted scale (100=safe, 20=dangerous), fixed breakpoints  
**Revised:** Standardized scale, granular, weighted

```typescript
interface CookieWeights {
    crossSiteTrackers: 5;  // Facebook, DoubleClick, Pinterest
    analyticsTrackers: 3;  // Google Analytics, Mixpanel
    thirdParty: 1;         // Other third-party cookies
}

export function detectCookies(): number {
    const cookies = parseCookies();
    
    // Categorize and weight cookies
    const categorized = categorizeCookies(cookies);
    
    const weightedCount = 
        (categorized.crossSiteTrackers * 5) +
        (categorized.analyticsTrackers * 3) +
        (categorized.thirdParty * 1);
    
    // Logarithmic scaling (same as tracking for consistency)
    // Formula: score = min(100, 15 × log₂(weightedCount + 1))
    //
    // Examples:
    // 0 cookies → 0
    // 2 analytics cookies (6 weighted) → 42
    // 1 Facebook cookie (5 weighted) → 37
    // 2 cross-site + 2 analytics (16 weighted) → 60
    // 5 cross-site + 5 analytics (40 weighted) → 77
    
    if (weightedCount === 0) return 0;
    
    const score = Math.min(100, Math.round(15 * Math.log2(weightedCount + 1)));
    
    console.log('[Cookie] Weighted calculation:', {
        counts: {
            crossSiteTrackers: categorized.crossSiteTrackers,
            analyticsTrackers: categorized.analyticsTrackers,
            thirdParty: categorized.thirdParty
        },
        weightedCount,
        formula: `min(100, 15 × log₂(${weightedCount} + 1))`,
        score
    });
    
    return score;
}
```

**Score Examples:**
- 0 third-party cookies → 0
- 2 Google Analytics cookies → 42
- 1 Facebook Pixel cookie → 37
- Multiple trackers (16 weighted) → 60
- Heavy tracking (40+ weighted) → 77+

---

### 5. Input Detector (0-100)

**Current:** Binary (0, 50, 100), ignores field count  
**Revised:** PII type weighting, field count matters

```typescript
interface PIIWeights {
    critical: 10;     // Credit card, SSN, password, bank account
    high: 7;          // Email, phone, government ID
    medium: 4;        // Address, date of birth, IP address
    low: 2;           // Name, username, company
    minimal: 1;       // Gender, age, country
}

/**
 * Comprehensive PII field detection patterns
 * Organized by sensitivity level with specific weights
 */
const PII_FIELD_PATTERNS = {
    // CRITICAL (Weight: 10) - Financial & Authentication
    critical: {
        weight: 10,
        patterns: [
            // Passwords
            { type: 'password', keywords: ['password', 'passwd', 'pwd', 'pass'] },
            
            // Credit Cards
            { type: 'credit-card', keywords: ['card', 'cc', 'creditcard', 'cardnumber', 'cardnum'] },
            { type: 'cvv', keywords: ['cvv', 'cvc', 'securitycode', 'csc'] },
            { type: 'card-expiry', keywords: ['expiry', 'expiration', 'exp', 'cardexp'] },
            
            // Banking
            { type: 'bank-account', keywords: ['account', 'accountnumber', 'routing', 'iban', 'swift'] },
            { type: 'bank-routing', keywords: ['routing', 'routingnumber', 'aba'] },
            
            // Government IDs
            { type: 'ssn', keywords: ['ssn', 'socialsecurity', 'social'] },
            { type: 'tax-id', keywords: ['taxid', 'ein', 'tin'] },
        ]
    },
    
    // HIGH (Weight: 7) - Personal Identifiers
    high: {
        weight: 7,
        patterns: [
            // Contact Information
            { type: 'email', keywords: ['email', 'e-mail', 'mail'] },
            { type: 'phone', keywords: ['phone', 'tel', 'mobile', 'cell', 'fax'] },
            
            // Government IDs (non-US)
            { type: 'passport', keywords: ['passport', 'passportnumber'] },
            { type: 'drivers-license', keywords: ['license', 'licence', 'dl', 'drivinglicense'] },
            { type: 'national-id', keywords: ['nationalid', 'idnumber', 'identitycard'] },
            
            // Biometric
            { type: 'biometric', keywords: ['fingerprint', 'retina', 'facial', 'biometric'] },
        ]
    },
    
    // MEDIUM (Weight: 4) - Location & Personal Data
    medium: {
        weight: 4,
        patterns: [
            // Address
            { type: 'street-address', keywords: ['address', 'street', 'addr', 'address1', 'address2'] },
            { type: 'city', keywords: ['city', 'town', 'municipality'] },
            { type: 'state', keywords: ['state', 'province', 'region'] },
            { type: 'zip', keywords: ['zip', 'postal', 'postcode', 'zipcode'] },
            
            // Date of Birth
            { type: 'dob', keywords: ['birth', 'dob', 'birthdate', 'birthday'] },
            
            // IP & Device
            { type: 'ip-address', keywords: ['ip', 'ipaddress', 'ipaddr'] },
            { type: 'mac-address', keywords: ['mac', 'macaddress'] },
            
            // Medical
            { type: 'medical', keywords: ['medical', 'health', 'diagnosis', 'prescription'] },
            { type: 'insurance', keywords: ['insurance', 'policynumber', 'memberId'] },
        ]
    },
    
    // LOW (Weight: 2) - Basic Identity
    low: {
        weight: 2,
        patterns: [
            // Names
            { type: 'full-name', keywords: ['name', 'fullname', 'realname'] },
            { type: 'first-name', keywords: ['firstname', 'fname', 'givenname'] },
            { type: 'last-name', keywords: ['lastname', 'lname', 'surname', 'familyname'] },
            { type: 'middle-name', keywords: ['middlename', 'mname'] },
            
            // Username
            { type: 'username', keywords: ['username', 'user', 'login', 'userid'] },
            
            // Organization
            { type: 'company', keywords: ['company', 'organization', 'employer', 'business'] },
            { type: 'job-title', keywords: ['title', 'jobtitle', 'position', 'role'] },
        ]
    },
    
    // MINIMAL (Weight: 1) - Demographics
    minimal: {
        weight: 1,
        patterns: [
            // Demographics
            { type: 'gender', keywords: ['gender', 'sex'] },
            { type: 'age', keywords: ['age'] },
            { type: 'country', keywords: ['country', 'nationality'] },
            { type: 'language', keywords: ['language', 'locale'] },
            { type: 'timezone', keywords: ['timezone', 'tz'] },
        ]
    }
};

export function detectSensitiveInputs(): number {
    const fields = scanInputFields();
    
    // Categorize by PII sensitivity
    const categorized = categorizeFields(fields);
    
    const weightedCount = 
        (categorized.critical.length * 10) +
        (categorized.high.length * 7) +
        (categorized.medium.length * 4) +
        (categorized.low.length * 2);
    
    // Logarithmic scaling
    // Formula: score = min(100, 12 × log₂(weightedCount + 1))
    //
    // Examples:
    // 0 fields → 0
    // 1 name field (2 weighted) → 19
    // 1 email field (7 weighted) → 36
    // 1 password field (10 weighted) → 42
    // 1 password + 2 emails (24 weighted) → 60
    // 3 passwords + 5 emails (65 weighted) → 75
    // Payment form (100+ weighted) → 90+
    
    if (weightedCount === 0) return 0;
    
    const score = Math.min(100, Math.round(12 * Math.log2(weightedCount + 1)));
    
    console.log('[Input] Weighted calculation:', {
        counts: {
            critical: categorized.critical.length,
            high: categorized.high.length,
            medium: categorized.medium.length,
            low: categorized.low.length
        },
        weightedCount,
        formula: `min(100, 12 × log₂(${weightedCount} + 1))`,
        score
    });
    
    return score;
}

function categorizeFields(fields: HTMLInputElement[]): {
    critical: HTMLInputElement[];
    high: HTMLInputElement[];
    medium: HTMLInputElement[];
    low: HTMLInputElement[];
} {
    const critical: HTMLInputElement[] = [];
    const high: HTMLInputElement[] = [];
    const medium: HTMLInputElement[] = [];
    const low: HTMLInputElement[] = [];
    
    for (const field of fields) {
        const type = field.type?.toLowerCase() || '';
        const name = field.name?.toLowerCase() || '';
        const id = field.id?.toLowerCase() || '';
        
        // Critical: Credit card, SSN, password
        if (
            type === 'password' ||
            name.includes('password') ||
            name.includes('card') ||
            name.includes('cvv') ||
            name.includes('ssn') ||
            id.includes('card') ||
            id.includes('password')
        ) {
            critical.push(field);
        }
        // High: Email, phone
        else if (
            type === 'email' ||
            type === 'tel' ||
            name.includes('email') ||
            name.includes('phone') ||
            name.includes('tel') ||
            id.includes('email') ||
            id.includes('phone')
        ) {
            high.push(field);
        }
        // Medium: Address, DOB
        else if (
            name.includes('address') ||
            name.includes('street') ||
            name.includes('city') ||
            name.includes('zip') ||
            name.includes('postal') ||
            name.includes('birth') ||
            name.includes('dob') ||
            type === 'date'
        ) {
            medium.push(field);
        }
        // Low: Name, username
        else if (
            name.includes('name') ||
            name.includes('user') ||
            id.includes('name') ||
            id.includes('user')
        ) {
            low.push(field);
        }
    }
    
    return { critical, high, medium, low };
}
```

**Score Examples:**
- 0 fields → 0
- Simple contact form (1 name, 1 email) → 43
- Login page (1 email, 1 password) → 52
- Signup form (name, email, password) → 59
- Payment form (name, email, address, card) → 73
- Extensive data collection (100+ weighted) → 90+

---

### 6. Policy Detector (0-100)

**Current:** Inconsistent (ToS;DR: 0-80, Fallback: 50-100)  
**Revised:** Standardized, granular

```typescript
export async function detectPrivacyPolicy(): Promise<number> {
    // Try ToS;DR API first
    const tosDRResult = await checkTosDR(window.location.href);
    
    if (tosDRResult.found) {
        // ToS;DR grade to standardized score (0-100)
        const gradeToScore = {
            'A': 0,   // Excellent policy
            'B': 20,  // Good policy
            'C': 50,  // Fair policy
            'D': 75,  // Poor policy
            'E': 100  // Very poor policy
        };
        
        return gradeToScore[tosDRResult.grade] || 50;
    }
    
    // Fallback: Local detection
    const localResult = detectLocalPrivacyPolicy();
    
    if (localResult.found) {
        // Policy found but no rating
        return 50; // Medium risk (we don't know if it's good or bad)
    }
    
    // No policy found
    return 75; // High risk (lack of transparency)
}
```

**Score Examples:**
- ToS;DR Grade A → 0
- ToS;DR Grade B → 20
- ToS;DR Grade C → 50
- ToS;DR Grade D → 75
- ToS;DR Grade E → 100
- Policy found (no grade) → 50
- No policy → 75

---

## 🎮 BEHAVIOR-BASED UPS SYSTEM

### Core Concept: Actions Have Consequences

**UPS Changes Based On:**
1. **Site WRS** - Visiting high-WRS sites loses UPS
2. **PII Entry** - Entering PII on risky sites loses UPS
3. **Safe Browsing** - Visiting low-WRS sites gains UPS

**NO time decay** - Your score only changes when you DO something.

---

### UPS Loss: Visiting Risky Sites

```typescript
/**
 * Calculate UPS impact when visiting a site
 * 
 * Formula: penalty = (WRS / 100) × 10
 * 
 * Examples:
 * - WRS 0 (safe): 0 penalty
 * - WRS 20 (low risk): -2 UPS
 * - WRS 50 (medium): -5 UPS
 * - WRS 80 (high risk): -8 UPS
 * - WRS 100 (critical): -10 UPS
 */
export function calculateSiteVisitImpact(
    currentUPS: number,
    siteWRS: number
): { newUPS: number; penalty: number; message?: string } {
    // Calculate penalty based on site risk
    const penalty = Math.round((siteWRS / 100) * 10);
    
    const newUPS = Math.max(0, currentUPS - penalty);
    
    let message: string | undefined;
    if (penalty >= 5) {
        message = `Visited risky site (WRS ${siteWRS}). UPS -${penalty}`;
    }
    
    console.log('[UPS Site Visit] Calculation:', {
        previousUPS: currentUPS,
        siteWRS,
        formula: `(${siteWRS} / 100) × 10 = ${penalty}`,
        penalty,
        newUPS
    });
    
    return { newUPS, penalty, message };
}
```

**Penalty Examples:**
- Visit WRS 0 site → No penalty
- Visit WRS 20 site → -2 UPS
- Visit WRS 50 site → -5 UPS
- Visit WRS 80 site → -8 UPS
- Visit WRS 100 site → -10 UPS

---

### UPS Loss: Entering PII

```typescript
/**
 * Calculate UPS penalty for entering PII
 * 
 * Formula: penalty = basePenalty × (1 + (WRS / 100))
 * 
 * Base Penalties:
 * - Critical PII (password, card): 15 points
 * - High PII (email, phone): 10 points
 * - Medium PII (address, DOB): 6 points
 * - Low PII (name, username): 3 points
 * 
 * Risk Multiplier: WRS / 100 (0.0 to 1.0)
 * - On safe site (WRS 0): no multiplier (×1.0)
 * - On medium site (WRS 50): ×1.5
 * - On risky site (WRS 100): ×2.0
 * 
 * Examples:
 * - Password on safe site (WRS 0): 15 × 1.0 = 15 points
 * - Password on medium site (WRS 50): 15 × 1.5 = 23 points
 * - Password on risky site (WRS 100): 15 × 2.0 = 30 points
 * - Email on safe site (WRS 0): 10 × 1.0 = 10 points
 * - Email on risky site (WRS 100): 10 × 2.0 = 20 points
 * - Name on safe site (WRS 0): 3 × 1.0 = 3 points
 * - Name on risky site (WRS 100): 3 × 2.0 = 6 points
 */
export function calculatePIIPenalty(
    currentUPS: number,
    piiType: 'critical' | 'high' | 'medium' | 'low',
    siteWRS: number
): { newUPS: number; penalty: number; calculation: any } {
    // Base penalty by PII sensitivity
    const basePenalties = {
        'critical': 15,  // Password, credit card, SSN
        'high': 10,      // Email, phone
        'medium': 6,     // Address, DOB
        'low': 3         // Name, username
    };
    
    const basePenalty = basePenalties[piiType];
    
    // Risk multiplier based on site WRS
    const riskMultiplier = 1 + (siteWRS / 100);
    
    // Final penalty
    const penalty = Math.round(basePenalty * riskMultiplier);
    
    const newUPS = Math.max(0, currentUPS - penalty);
    
    console.log('[UPS PII Penalty] Contextual calculation:', {
        piiType,
        basePenalty,
        siteWRS,
        riskMultiplier: riskMultiplier.toFixed(2),
        formula: `${basePenalty} × ${riskMultiplier.toFixed(2)} = ${penalty}`,
        previousUPS: currentUPS,
        penalty,
        newUPS
    });
    
    return {
        newUPS,
        penalty,
        calculation: {
            basePenalty,
            piiType,
            siteWRS,
            riskMultiplier
        }
    };
}
```

**Penalty Examples:**
- Password on Google (WRS 0): -15 UPS
- Password on sketchy site (WRS 100): -30 UPS
- Email on news site (WRS 30): -13 UPS
- Name on safe site (WRS 10): -3 UPS

**This is NOTICEABLE but RECOVERABLE.**

---

### UPS Gain: Safe Browsing

```typescript
/**
 * Calculate UPS recovery when visiting safe sites
 * 
 * Formula: recovery = (100 - WRS) / 50
 * 
 * Examples:
 * - WRS 0 (very safe): +2.0 UPS
 * - WRS 10 (safe): +1.8 UPS
 * - WRS 20 (safe): +1.6 UPS
 * - WRS 30 (low risk): +1.4 UPS
 * - WRS 50 (medium): +1.0 UPS
 * - WRS 70 (high risk): +0.6 UPS
 * - WRS 100 (critical): +0.0 UPS
 */
export function calculateSafeVisitRecovery(
    currentUPS: number,
    siteWRS: number
): { newUPS: number; recovery: number; message?: string } {
    // Recovery based on how safe the site is
    const recovery = Math.max(0, (100 - siteWRS) / 50);
    
    const newUPS = Math.min(100, currentUPS + recovery);
    
    let message: string | undefined;
    if (recovery >= 1.5) {
        message = `Visited safe site (WRS ${siteWRS}). UPS +${recovery.toFixed(1)}`;
    }
    
    console.log('[UPS Recovery] Calculation:', {
        previousUPS: currentUPS,
        siteWRS,
        formula: `(100 - ${siteWRS}) / 50 = ${recovery.toFixed(2)}`,
        recovery: recovery.toFixed(2),
        newUPS: newUPS.toFixed(1)
    });
    
    return {
        newUPS: Math.round(newUPS),
        recovery: Math.round(recovery * 10) / 10,
        message
    };
}
```

**Recovery Examples:**
- Visit WRS 0 site → +2.0 UPS
- Visit WRS 20 site → +1.6 UPS
- Visit WRS 50 site → +1.0 UPS

**Recovery is GRADUAL but CONSISTENT.**

---

### Combined UPS Logic

```typescript
/**
 * Handle page visit: Apply visit penalty AND recovery
 * 
 * Logic:
 * 1. Calculate penalty for visiting risky site
 * 2. Calculate recovery for safe components
 * 3. Net effect determines UPS change
 */
export function handlePageVisit(
    currentUPS: number,
    siteWRS: number
): { newUPS: number; change: number; message: string } {
    // Penalize for risky sites (WRS > 40)
    let penalty = 0;
    if (siteWRS > 40) {
        penalty = Math.round((siteWRS / 100) * 10);
    }
    
    // Recover from safe sites (WRS < 40)
    let recovery = 0;
    if (siteWRS < 40) {
        recovery = (100 - siteWRS) / 50;
    }
    
    // Net change
    const netChange = recovery - penalty;
    const newUPS = Math.max(0, Math.min(100, currentUPS + netChange));
    
    let message = '';
    if (netChange > 0) {
        message = `Safe browsing! WRS ${siteWRS} (+${netChange.toFixed(1)} UPS)`;
    } else if (netChange < 0) {
        message = `Risky site detected! WRS ${siteWRS} (${netChange.toFixed(1)} UPS)`;
    } else {
        message = `Neutral site. WRS ${siteWRS}`;
    }
    
    return {
        newUPS: Math.round(newUPS),
        change: Math.round(netChange * 10) / 10,
        message
    };
}
```

---

## ✅ SCORE VALIDATION

### Ensure All Scores Are Valid

```typescript
/**
 * Validate detector score is in range [0, 100]
 */
export function validateDetectorScore(
    score: number,
    detectorName: string
): number {
    if (typeof score !== 'number' || isNaN(score)) {
        console.error(`[Validation] Invalid score from ${detectorName}: ${score}`);
        return 50; // Default to medium risk
    }
    
    if (score < 0 || score > 100) {
        console.warn(`[Validation] Out-of-range score from ${detectorName}: ${score}`);
        return Math.max(0, Math.min(100, score));
    }
    
    return Math.round(score);
}

/**
 * Validate WRS weights sum to 1.0
 */
export function validateWeights(
    weights: Record<string, number>
): boolean {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    const TOLERANCE = 0.001;
    
    if (Math.abs(sum - 1.0) > TOLERANCE) {
        console.error(`[Validation] Weight sum is ${sum}, expected 1.0`);
        return false;
    }
    
    return true;
}

/**
 * Enhanced WRS calculation with validation
 */
export function calculateWRS(breakdown: ScoreBreakdown): number {
    const weights = {
        protocol: 0.25,
        reputation: 0.25,
        tracking: 0.20,
        cookies: 0.15,
        input: 0.10,
        policy: 0.05
    };
    
    // Validate weights on first call
    if (!validateWeights(weights)) {
        throw new Error('WRS weights do not sum to 1.0');
    }
    
    // Validate all detector scores
    const validated = {
        protocol: validateDetectorScore(breakdown.protocol, 'protocol'),
        reputation: validateDetectorScore(breakdown.reputation, 'reputation'),
        tracking: validateDetectorScore(breakdown.tracking, 'tracking'),
        cookies: validateDetectorScore(breakdown.cookies, 'cookies'),
        input: validateDetectorScore(breakdown.input, 'input'),
        policy: validateDetectorScore(breakdown.policy, 'policy')
    };
    
    // Calculate weighted sum
    const wrs = 
        (validated.protocol * weights.protocol) +
        (validated.reputation * weights.reputation) +
        (validated.tracking * weights.tracking) +
        (validated.cookies * weights.cookies) +
        (validated.input * weights.input) +
        (validated.policy * weights.policy);
    
    // Clamp and round
    return Math.max(0, Math.min(100, Math.round(wrs)));
}
```

---

## 🐛 DEBUG-ONLY LOGGING

### Conditional Logging System

```typescript
// lib/logger.ts
const IS_DEBUG = process.env.NODE_ENV === 'development';

export const logger = {
    debug(component: string, message: string, data?: any) {
        if (!IS_DEBUG) return;
        console.log(`[${component}] ${message}`, data ?? '');
    },
    
    info(component: string, message: string, data?: any) {
        if (!IS_DEBUG) return;
        console.info(`[${component}] ${message}`, data ?? '');
    },
    
    warn(component: string, message: string, data?: any) {
        console.warn(`[${component}] ${message}`, data ?? '');
    },
    
    error(component: string, message: string, error?: any) {
        console.error(`[${component}] ${message}`, error ?? '');
    }
};

// Usage in detectors:
// BEFORE:
console.log('[Cookie Detector] Starting analysis...');

// AFTER:
logger.debug('Cookie', 'Starting analysis');
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Standardize Detectors (4-6 hours)
- [ ] Fix cookie detector: Change to 0-100 scale, add logarithmic scaling
- [ ] Fix input detector: Add PII type weighting, logarithmic scaling
- [ ] Fix policy detector: Standardize ToS;DR mapping
- [ ] Fix tracking detector: Add logarithmic scaling (already 0-100)
- [ ] Update protocol detector: Add mixed content detection
- [ ] Update reputation detector: Multi-layer weighted scoring

### Phase 2: Implement Behavior-Based UPS (3-4 hours)
- [ ] Remove all time-decay logic
- [ ] Implement site visit penalty (WRS-based)
- [ ] Implement PII entry penalty (type + WRS-based)
- [ ] Implement safe browsing recovery (WRS-based)
- [ ] Update background worker to use new logic
- [ ] Update UI to show UPS changes with reasons

### Phase 3: Add Validation (2-3 hours)
- [ ] Add detector score validation
- [ ] Add weight sum validation
- [ ] Add bounds checking to all calculations
- [ ] Add error handling for invalid scores

### Phase 4: Optimize Logging (1-2 hours)
- [ ] Create logger utility
- [ ] Replace all console.log with logger.debug
- [ ] Keep console.warn and console.error for production
- [ ] Test in development and production modes

### Phase 5: Testing (2-3 hours)
- [ ] Test all detectors return 0-100
- [ ] Test WRS manual calculation matches code
- [ ] Test UPS loss on risky sites
- [ ] Test UPS gain on safe sites
- [ ] Test PII penalties scale with risk
- [ ] Test score validation catches errors
- [ ] Test logging only appears in debug mode

---

## 🎯 EXPECTED OUTCOMES

### User Experience
✅ Scores are **understandable** - Manual calculation is possible  
✅ Penalties are **noticeable** - Users see the impact of risky behavior  
✅ Recovery is **achievable** - Safe browsing rebuilds confidence  
✅ Feedback is **immediate** - No waiting for time decay  
✅ System is **fair** - Only penalized for actual risky actions

### Technical Quality
✅ All scores use **same scale** (0-100, safe-to-dangerous)  
✅ All detectors have **granularity** (not binary)  
✅ All weights are **justified** (type-based, not arbitrary)  
✅ All calculations are **validated** (bounds checking)  
✅ All logging is **conditional** (debug mode only)

### Educational Value
✅ Users **learn** what makes sites risky  
✅ Users **understand** how to improve their UPS  
✅ Users **trust** the scoring system (transparency)  
✅ Users **change behavior** (meaningful feedback)

---

**Total Implementation Time:** 12-18 hours  
**Complexity:** Medium (refactoring + new logic)  
**Impact:** High (fixes core scoring system)

Ready to implement? Let's start with Phase 1!
