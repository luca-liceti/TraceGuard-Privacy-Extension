/**
 * =============================================================================
 * SCORING LIBRARY - How We Calculate Website Safety Scores
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file contains the math that calculates the "Website Safety Score" (WSS).
 * The WSS tells you how safe or dangerous a website is on a scale from 0 to 100.
 * 
 * SCORING PHILOSOPHY:
 * - Higher scores = BETTER (100 = completely safe, 0 = very dangerous)
 * - Each website is analyzed in 6 different ways (called "detectors")
 * - Each detector gives its own score, then we combine them with different weights
 * 
 * THE 6 DETECTORS AND THEIR WEIGHTS:
 * 1. Protocol (25%): Is the connection secure (HTTPS) or not (HTTP)?
 * 2. Reputation (25%): Is this domain on any blacklists or malware databases?
 * 3. Tracking (20%): How many third-party trackers are following you?
 * 4. Cookies (15%): Are there tracking or advertising cookies?
 * 5. Inputs (10%): Are there sensitive fields like password or credit card?
 * 6. Policy (5%): What does the privacy policy say (according to ToS;DR)?
 * 
 * EXAMPLE:
 * If a site has:
 * - HTTPS: 100 × 25% = 25
 * - Good reputation: 100 × 25% = 25
 * - Some trackers: 60 × 20% = 12
 * - Few cookies: 80 × 15% = 12
 * - Login form: 65 × 10% = 6.5
 * - No policy rating: excluded
 * Final WSS = 80.5 (pretty safe!)
 * =============================================================================
 */

import { ScoreBreakdown } from './types';

// =============================================================================
// SCORE VALIDATION
// Makes sure scores are always valid numbers between 0 and 100
// =============================================================================

/**
 * Validates and clamps a score to ensure it's a valid number between 0 and 100.
 * 
 * Sometimes calculations might produce weird values (like NaN, undefined, or -5).
 * This function catches those problems and returns a safe, valid score.
 * 
 * @param score - The score to validate (might be undefined, null, or NaN)
 * @param fallback - What to use if the score is invalid (default: 50)
 * @returns A valid score between 0 and 100
 * 
 * EXAMPLES:
 * - validateScore(85) → 85 (valid, no change)
 * - validateScore(150) → 100 (clamped to max)
 * - validateScore(-10) → 0 (clamped to min)
 * - validateScore(undefined) → 50 (uses fallback)
 * - validateScore(NaN) → 50 (uses fallback)
 */
export function validateScore(score: number | undefined | null, fallback: number = 50): number {
    // Check if the score is unusable (undefined, null, or NaN)
    if (score === undefined || score === null || isNaN(score)) {
        console.warn(`[Score Validation] Invalid score detected, using fallback: ${fallback}`);
        return fallback;
    }

    // Clamp the score to be between 0 and 100, and round to whole number
    // Math.max(0, ...) ensures we don't go below 0
    // Math.min(100, ...) ensures we don't go above 100
    return Math.max(0, Math.min(100, Math.round(score)));
}

// =============================================================================
// WEBSITE SAFETY SCORE (WSS) CALCULATION
// The main scoring algorithm that combines all detector scores
// =============================================================================

/**
 * Calculates the Website Safety Score (WSS) for a website.
 * 
 * This is the main function that takes scores from all 6 detectors and
 * combines them into a single overall score. Think of it like calculating
 * a weighted average for a class - some tests count more than others!
 * 
 * @param breakdown - An object containing scores from each detector
 * @returns The overall Website Safety Score (0-100)
 */
export function calculateWSS(breakdown: ScoreBreakdown): number {
    // STEP 1: Validate all input scores to ensure they're usable
    // This prevents weird bugs from invalid numbers
    const validatedBreakdown = {
        protocol: validateScore(breakdown.protocol),
        reputation: validateScore(breakdown.reputation),
        tracking: validateScore(breakdown.tracking),
        cookies: validateScore(breakdown.cookies),
        input: validateScore(breakdown.input),
        policy: validateScore(breakdown.policy)
    };

    // STEP 2: Check if the policy score is a "fallback" (neutral) score
    // Score 50 means "we found a privacy link but no ToS;DR rating"
    // In this case, we exclude policy from the calculation to avoid penalizing
    // sites that simply don't have a ToS;DR rating yet
    const isPolicyFallback = validatedBreakdown.policy === 50;

    // STEP 3: Define the weights for each detector
    // These add up to 100% (1.0)
    let weights = {
        protocol: 0.25,    // 25% - HTTPS is very important
        reputation: 0.25,  // 25% - Blacklist status is critical
        tracking: 0.20,    // 20% - Tracker count matters a lot
        cookies: 0.15,     // 15% - Tracking cookies are concerning
        input: 0.10,       // 10% - Sensitive fields are relevant
        policy: 0.05       // 5% - Privacy policy is nice to know
    };

    // STEP 4: If policy is a fallback, redistribute its weight to other detectors
    // This ensures the total still adds up to 100%
    if (isPolicyFallback) {
        const policyWeight = weights.policy;
        weights.policy = 0;  // Policy contributes 0

        // Redistribute proportionally to other metrics
        // We divide each weight by (1 - policyWeight) to scale them up
        const otherTotal = 1 - policyWeight;
        weights.protocol = weights.protocol / otherTotal;
        weights.reputation = weights.reputation / otherTotal;
        weights.tracking = weights.tracking / otherTotal;
        weights.cookies = weights.cookies / otherTotal;
        weights.input = weights.input / otherTotal;

        console.log(`[WSS] Policy excluded (fallback score ${validatedBreakdown.policy}) - weight redistributed`);
    }

    // STEP 5: Calculate how much each detector contributes to the final score
    // contribution = detector_score × detector_weight
    const contributions = {
        protocol: validatedBreakdown.protocol * weights.protocol,
        reputation: validatedBreakdown.reputation * weights.reputation,
        tracking: validatedBreakdown.tracking * weights.tracking,
        cookies: validatedBreakdown.cookies * weights.cookies,
        input: validatedBreakdown.input * weights.input,
        policy: validatedBreakdown.policy * weights.policy
    };

    // STEP 6: Add up all contributions to get the final score
    const totalWeightedScore =
        contributions.protocol +
        contributions.reputation +
        contributions.tracking +
        contributions.cookies +
        contributions.input +
        contributions.policy;

    // Validate the final score (round it and ensure it's 0-100)
    const finalScore = validateScore(totalWeightedScore);

    // STEP 7: Log the calculation details for debugging and transparency
    // This creates a nice "tree" view in the console
    console.log(`[WSS Calculation] Website Safety Score for current page`);
    console.log(`├── Protocol: ${validatedBreakdown.protocol} × ${(weights.protocol * 100).toFixed(0)}% = ${contributions.protocol.toFixed(2)}`);
    console.log(`├── Reputation: ${validatedBreakdown.reputation} × ${(weights.reputation * 100).toFixed(0)}% = ${contributions.reputation.toFixed(2)}`);
    console.log(`├── Tracking: ${validatedBreakdown.tracking} × ${(weights.tracking * 100).toFixed(0)}% = ${contributions.tracking.toFixed(2)}`);
    console.log(`├── Cookies: ${validatedBreakdown.cookies} × ${(weights.cookies * 100).toFixed(0)}% = ${contributions.cookies.toFixed(2)}`);
    console.log(`├── Input: ${validatedBreakdown.input} × ${(weights.input * 100).toFixed(0)}% = ${contributions.input.toFixed(2)}`);
    if (!isPolicyFallback) {
        console.log(`├── Policy: ${validatedBreakdown.policy} × ${(weights.policy * 100).toFixed(0)}% = ${contributions.policy.toFixed(2)}`);
    } else {
        console.log(`├── Policy: EXCLUDED (no ToS;DR rating)`);
    }
    console.log(`├── Sum: ${totalWeightedScore.toFixed(2)}`);

    // Add a nice emoji indicator of the safety level
    console.log(`└── Final WSS: ${finalScore} (${finalScore >= 80 ? '✅ Safe' : finalScore >= 60 ? '🔵 Low Risk' : finalScore >= 40 ? '🟡 Medium' : finalScore >= 20 ? '🟠 High Risk' : '🔴 Critical'})`);

    return finalScore;
}

// =============================================================================
// LEGACY FUNCTION
// Kept for backward compatibility with older code that might use the old name
// =============================================================================

/**
 * @deprecated This function is deprecated (outdated). Use calculateWSS instead.
 * 
 * This was the old name for the scoring function. It's kept here so old code
 * doesn't break, but new code should use calculateWSS.
 */
export function calculateWRS(breakdown: ScoreBreakdown): number {
    console.warn('[Deprecation] calculateWRS is deprecated, use calculateWSS instead');
    return calculateWSS(breakdown);
}
