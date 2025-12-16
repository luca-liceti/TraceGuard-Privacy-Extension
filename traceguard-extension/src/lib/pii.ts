// PII (Personally Identifiable Information) patterns
const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
};

export interface PIIDetectionResult {
    hasPII: boolean;
    types: string[];
    count: number;
}

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

// Constants for Streak-Based Recovery
const SAFE_WRS_THRESHOLD = 30; // Sites under this score count as "safe"
const STREAK_MILESTONE = 5;    // Every 5 safe sites triggers a bonus
const RECOVERY_AMOUNT = 3;     // Amount recovered per milestone

export interface VisitImpactResult {
    newUPS: number;
    newStreak: number;
    message?: string;
}

/**
 * Calculate UPS impact based on site visit (Streak-Based Recovery)
 * 
 * Logic:
 * 1. If site is SAFE (WRS < 30):
 *    - Increment safe streak
 *    - If streak hits multiple of 5 (5, 10, 15...), recovering +3 UPS
 * 
 * 2. If site is RISKY (WRS > 50):
 *    - Reset streak to 0
 *    - No penalty to UPS (UPS only drops on PII events currently)
 * 
 * 3. Neutral sites (30-50):
 *    - Maintain streak but don't increment
 */
export function calculateVisitImpact(
    currentUPS: number,
    siteWRS: number,
    currentStreak: number
): VisitImpactResult {
    let newUPS = currentUPS;
    let newStreak = currentStreak;
    let message = undefined;

    console.log('[UPS Visit Calculation] Starting...');
    console.log(`[UPS] Context: UPS=${currentUPS}, WRS=${siteWRS}, Streak=${currentStreak}`);

    if (siteWRS < SAFE_WRS_THRESHOLD) {
        // Safe Site
        newStreak++;
        console.log(`[UPS] Safe site visited! Streak increased to ${newStreak}`);

        // Check for milestone
        if (newStreak % STREAK_MILESTONE === 0) {
            newUPS = Math.min(100, currentUPS + RECOVERY_AMOUNT);
            message = `Safe streak bonus! +${RECOVERY_AMOUNT} UPS (${newStreak} safe sites)`;
            console.log(`[UPS] Milestone reached! ${message}`);
        }
    } else if (siteWRS > 50) {
        // Risky Site
        if (newStreak > 0) {
            message = `Streak broken by risky site (WRS ${siteWRS})`;
            console.log(`[UPS] ${message}`);
        }
        newStreak = 0;
    } else {
        // Neutral site (30-50)
        console.log('[UPS] Neutral site. Streak maintained but not increased.');
    }

    return { newUPS, newStreak, message };
}

/**
 * Calculate penalty when PII is detected
 * Subtracts 5 points from current UPS
 */
export function calculatePIIPenalty(currentUPS: number): { newUPS: number, penalty: number } {
    const penalty = 5;
    const newUPS = Math.max(0, currentUPS - penalty);
    console.log(`[UPS PII Penalty] UPS reduced by ${penalty} (from ${currentUPS} to ${newUPS})`);
    return { newUPS, penalty };
}

/**
 * Legacy function for backward compatibility
 * Calculates UPS based on PII events count only (no decay/recovery)
 */
export function calculateUPS(piiEventsCount: number): number {
    // UPS decreases as user shares more PII
    // Start at 100, decrease by 5 points for each PII event
    // Minimum score is 0

    const baseScore = 100;
    const penaltyPerEvent = 5;

    const score = Math.max(0, baseScore - (piiEventsCount * penaltyPerEvent));

    console.log('[UPS Legacy Calculation] PII Events:', piiEventsCount);
    console.log('[UPS Legacy] Formula:', `${baseScore} - (${piiEventsCount} × ${penaltyPerEvent}) = ${score}`);
    console.log('[UPS Legacy] Final Score:', score);

    return Math.round(score);
}

