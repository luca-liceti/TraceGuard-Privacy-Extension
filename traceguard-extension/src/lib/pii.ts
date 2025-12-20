/**
 * =============================================================================
 * PII DETECTION & UPS CALCULATION - Privacy Score System
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file handles your User Privacy Score (UPS) - a number from 0 to 100
 * that represents how well you're protecting your personal information.
 * 
 * KEY TERMS:
 * - PII = Personally Identifiable Information (email, SSN, credit card, etc.)
 * - UPS = User Privacy Score (your personal score, 0-100)
 * - WSS = Website Safety Score (a website's score, 0-100)
 * 
 * SCORING PHILOSOPHY (Higher = Better):
 * - 100 = Perfect privacy (you haven't shared sensitive data)
 * - 50 = Some exposure (you've shared data on some sites)
 * - 0 = High exposure (you've shared sensitive data on risky sites)
 * 
 * HOW YOUR SCORE CHANGES:
 * 
 * PENALTIES (score goes DOWN):
 * 1. Visiting risky sites: Small penalty based on site's WSS
 * 2. Entering PII: Bigger penalty, especially on unsafe sites
 *    - Password on safe site: -8 points
 *    - Password on risky site: -16 points (2x multiplier!)
 * 
 * RECOVERY (score goes UP):
 * 1. Visiting safe sites (WSS >= 70): Small recovery
 * 2. Safe streak bonus: +2 every 10 consecutive safe sites
 * 
 * PENALTY EXAMPLES:
 * | Field Type     | Base Penalty | On Safe Site (WSS 100) | On Risky Site (WSS 0) |
 * |----------------|--------------|------------------------|----------------------|
 * | SSN            | 10           | 10                     | 20                   |
 * | Credit Card    | 9            | 9                      | 18                   |
 * | Password       | 8            | 8                      | 16                   |
 * | Phone          | 5            | 5                      | 10                   |
 * | Email          | 4            | 4                      | 8                    |
 * | Address        | 3            | 3                      | 6                    |
 * | Name           | 1            | 1                      | 2                    |
 * =============================================================================
 */

// ============================================================================
// PII PATTERNS (for content scanning)
// Regular expressions to detect common PII formats
// ============================================================================

/**
 * Regular expressions to detect PII patterns in text.
 * These are used to identify sensitive data WITHOUT storing it.
 */
export const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
};

/**
 * Result of scanning text for PII patterns.
 */
export interface PIIDetectionResult {
    hasPII: boolean;    // Was any PII found?
    types: string[];    // Which types were found (email, phone, etc.)
    count: number;      // Total number of matches
}

/**
 * Scans text for PII patterns.
 * Used to detect if a page contains visible personal information.
 * 
 * @param text - The text to scan
 * @returns Information about PII found (types and count)
 */
export function detectPII(text: string): PIIDetectionResult {
    const types: string[] = [];
    let count = 0;

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
        const matches = text.match(new RegExp(pattern, 'g'));
        if (matches && matches.length > 0) {
            types.push(type);
            count += matches.length;
        }
    }

    return {
        hasPII: types.length > 0,
        types,
        count
    };
}

// ============================================================================
// PENALTY CONFIGURATION
// ============================================================================

/**
 * Base penalties for each PII field type
 * Higher = more sensitive = bigger UPS impact
 */
export const BASE_PENALTIES: Record<string, number> = {
    // Critical (8-10 points)
    ssn: 10,
    creditCard: 9,
    password: 8,

    // High (5-7 points)
    phone: 5,

    // Medium (3-4 points)
    email: 4,
    address: 3,

    // Low (1-2 points)
    name: 1,
    username: 2,

    // Default for unknown types
    unknown: 3
};

/**
 * Get base penalty for a field type
 */
export function getBasePenalty(fieldType: string): number {
    const normalizedType = fieldType.toLowerCase();
    return BASE_PENALTIES[normalizedType] || BASE_PENALTIES.unknown;
}

// ============================================================================
// VISIT PENALTY
// ============================================================================

export interface VisitPenaltyResult {
    penalty: number;
    newUPS: number;
    message: string;
}

/**
 * Calculate UPS penalty for visiting a site
 * 
 * Formula: penalty = ((100 - WSS) / 100) * 2
 * - WSS 100 (safe) → 0 penalty
 * - WSS 50 (medium) → 1 penalty
 * - WSS 0 (dangerous) → 2 penalty
 */
export function calculateVisitPenalty(currentUPS: number, siteWSS: number): VisitPenaltyResult {
    // Clamp WSS to valid range
    const clampedWSS = Math.max(0, Math.min(100, siteWSS));

    // Calculate penalty (max 2 per visit)
    const penalty = ((100 - clampedWSS) / 100) * 2;
    const roundedPenalty = Math.round(penalty * 10) / 10; // Round to 1 decimal

    // Apply penalty
    const newUPS = Math.max(0, Math.round((currentUPS - roundedPenalty) * 10) / 10);

    // Generate message
    let message = '';
    if (roundedPenalty > 0) {
        const riskLevel = clampedWSS >= 70 ? 'safe' : clampedWSS >= 40 ? 'medium-risk' : 'risky';
        message = `Visited ${riskLevel} site (WSS ${clampedWSS}): -${roundedPenalty.toFixed(1)} UPS`;
    }

    console.log(`[UPS Visit Penalty] Calculation:`);
    console.log(`├── Current UPS: ${currentUPS}`);
    console.log(`├── Site WSS: ${clampedWSS}`);
    console.log(`├── Formula: ((100 - ${clampedWSS}) / 100) × 2 = ${roundedPenalty.toFixed(2)}`);
    console.log(`└── New UPS: ${newUPS}`);

    return { penalty: roundedPenalty, newUPS, message };
}

// ============================================================================
// PII ENTRY PENALTY
// ============================================================================

export interface PIIPenaltyResult {
    penalty: number;
    newUPS: number;
    message: string;
}

/**
 * Calculate UPS penalty for entering PII
 * 
 * Formula: penalty = basePenalty * contextMultiplier
 * where contextMultiplier = 1 + ((100 - WSS) / 100)
 * 
 * Examples:
 * - Password on WSS 100 site: 8 × 1.0 = 8
 * - Password on WSS 50 site: 8 × 1.5 = 12
 * - Password on WSS 0 site: 8 × 2.0 = 16
 */
export function calculatePIIPenalty(
    currentUPS: number,
    fieldType: string,
    siteWSS: number
): PIIPenaltyResult {
    // Get base penalty for this field type
    const basePenalty = getBasePenalty(fieldType);

    // Clamp WSS to valid range
    const clampedWSS = Math.max(0, Math.min(100, siteWSS));

    // Calculate context multiplier (1.0 to 2.0 based on site risk)
    const contextMultiplier = 1 + ((100 - clampedWSS) / 100);

    // Calculate final penalty
    const penalty = Math.round(basePenalty * contextMultiplier);

    // Apply penalty
    const newUPS = Math.max(0, currentUPS - penalty);

    // Generate message
    const riskLevel = clampedWSS >= 70 ? 'safe' : clampedWSS >= 40 ? 'medium-risk' : 'risky';
    const message = `Entered ${fieldType} on ${riskLevel} site (WSS ${clampedWSS}): -${penalty} UPS`;

    console.log(`[UPS PII Penalty] Calculation:`);
    console.log(`├── Field Type: ${fieldType}`);
    console.log(`├── Base Penalty: ${basePenalty}`);
    console.log(`├── Site WSS: ${clampedWSS}`);
    console.log(`├── Context Multiplier: 1 + ((100 - ${clampedWSS}) / 100) = ${contextMultiplier.toFixed(2)}`);
    console.log(`├── Final Penalty: ${basePenalty} × ${contextMultiplier.toFixed(2)} = ${penalty}`);
    console.log(`├── Current UPS: ${currentUPS}`);
    console.log(`└── New UPS: ${newUPS}`);

    return { penalty, newUPS, message };
}

// ============================================================================
// FORM FOCUS PENALTY (Intent Tracking)
// ============================================================================

export interface FocusPenaltyResult {
    penalty: number;
    newUPS: number;
    message: string;
}

/**
 * Calculate smaller penalty for focusing on a sensitive field (intent tracking)
 * This is 20% of the full PII penalty
 */
export function calculateFocusPenalty(
    currentUPS: number,
    fieldType: string,
    siteWSS: number
): FocusPenaltyResult {
    const basePenalty = getBasePenalty(fieldType);
    const clampedWSS = Math.max(0, Math.min(100, siteWSS));
    const contextMultiplier = 1 + ((100 - clampedWSS) / 100);

    // Focus penalty is 20% of full penalty
    const fullPenalty = basePenalty * contextMultiplier;
    const penalty = Math.round(fullPenalty * 0.2 * 10) / 10;

    const newUPS = Math.max(0, Math.round((currentUPS - penalty) * 10) / 10);
    const message = penalty > 0 ? `Focused on ${fieldType} field: -${penalty.toFixed(1)} UPS` : '';

    console.log(`[UPS Focus Penalty] ${fieldType}: -${penalty.toFixed(1)} (20% of full penalty)`);

    return { penalty, newUPS, message };
}

// ============================================================================
// RECOVERY SYSTEM
// ============================================================================

export interface RecoveryResult {
    recovery: number;
    newUPS: number;
    newStreak: number;
    message: string;
}

/**
 * Calculate UPS recovery from visiting safe sites
 * 
 * Requirements:
 * - Site must have WSS >= 70 to qualify for recovery
 * - Recovery rate: ((WSS - 70) / 30) × 0.5
 * - Streak bonus: +2 every 10 consecutive safe sites
 * 
 * Examples:
 * - WSS 70: ((70-70)/30) × 0.5 = 0
 * - WSS 85: ((85-70)/30) × 0.5 = 0.25
 * - WSS 100: ((100-70)/30) × 0.5 = 0.5
 */
export function calculateRecovery(
    currentUPS: number,
    siteWSS: number,
    currentStreak: number
): RecoveryResult {
    const clampedWSS = Math.max(0, Math.min(100, siteWSS));
    let newStreak = currentStreak;
    let recovery = 0;
    let message = '';

    // Only recover from safe sites (WSS >= 70)
    if (clampedWSS >= 70) {
        // Increment safe streak
        newStreak = currentStreak + 1;

        // Calculate base recovery
        recovery = ((clampedWSS - 70) / 30) * 0.5;

        // Check for streak bonus (every 10 consecutive safe sites)
        if (newStreak > 0 && newStreak % 10 === 0) {
            recovery += 2;
            message = `🎉 Safe streak bonus! +2 UPS (${newStreak} safe sites in a row)`;
            console.log(`[UPS Recovery] ${message}`);
        }

        // Round recovery
        recovery = Math.round(recovery * 10) / 10;

        if (recovery > 0 && !message) {
            message = `Safe browsing recovery: +${recovery.toFixed(1)} UPS`;
        }
    } else {
        // Risky site breaks the streak
        if (currentStreak > 0) {
            message = `Safe streak broken (${currentStreak} → 0) by site with WSS ${clampedWSS}`;
            console.log(`[UPS Recovery] ${message}`);
        }
        newStreak = 0;
    }

    // Apply recovery (cap at 100)
    const newUPS = Math.min(100, Math.round((currentUPS + recovery) * 10) / 10);

    console.log(`[UPS Recovery] Calculation:`);
    console.log(`├── Site WSS: ${clampedWSS}`);
    console.log(`├── Qualifies for recovery: ${clampedWSS >= 70 ? 'Yes' : 'No'}`);
    console.log(`├── Streak: ${currentStreak} → ${newStreak}`);
    console.log(`├── Recovery: ${recovery.toFixed(2)}`);
    console.log(`└── UPS: ${currentUPS} → ${newUPS}`);

    return { recovery, newUPS, newStreak, message };
}

// ============================================================================
// COMBINED VISIT IMPACT (Penalty OR Recovery)
// ============================================================================

export interface VisitImpactResult {
    newUPS: number;
    newStreak: number;
    upsChange: number;
    message?: string;
}

/**
 * Calculate the full impact of visiting a site
 * Combines visit penalty (for risky sites) with recovery (for safe sites)
 */
export function calculateVisitImpact(
    currentUPS: number,
    siteWSS: number,
    currentStreak: number
): VisitImpactResult {
    const clampedWSS = Math.max(0, Math.min(100, siteWSS));

    // Safe sites (WSS >= 70): Recovery
    if (clampedWSS >= 70) {
        const recoveryResult = calculateRecovery(currentUPS, clampedWSS, currentStreak);
        return {
            newUPS: recoveryResult.newUPS,
            newStreak: recoveryResult.newStreak,
            upsChange: recoveryResult.recovery,
            message: recoveryResult.message
        };
    }

    // Risky sites (WSS < 70): Penalty + break streak
    const penaltyResult = calculateVisitPenalty(currentUPS, clampedWSS);
    return {
        newUPS: penaltyResult.newUPS,
        newStreak: 0, // Reset streak
        upsChange: -penaltyResult.penalty,
        message: penaltyResult.message || (currentStreak > 0 ? `Streak broken by WSS ${clampedWSS} site` : undefined)
    };
}

// ============================================================================
// LEGACY FUNCTION (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use calculatePIIPenalty or calculateVisitImpact instead
 * Legacy function that calculates UPS based only on PII events count
 */
export function calculateUPS(piiEventsCount: number): number {
    console.warn('[Deprecation] calculateUPS is deprecated. Use granular penalty functions instead.');

    const baseScore = 100;
    const penaltyPerEvent = 5;
    const score = Math.max(0, baseScore - (piiEventsCount * penaltyPerEvent));

    return Math.round(score);
}
