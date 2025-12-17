import { ScoreBreakdown } from './types';

/**
 * Validate and clamp a score to 0-100 range
 * Handles NaN, undefined, and out-of-range values
 */
export function validateScore(score: number | undefined | null, fallback: number = 50): number {
    if (score === undefined || score === null || isNaN(score)) {
        console.warn(`[Score Validation] Invalid score detected, using fallback: ${fallback}`);
        return fallback;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate Website Safety Score (WSS) using 6-context weighted formula
 * 
 * SCORING PHILOSOPHY (v3.0): Higher = Better (100 = safe, 0 = dangerous)
 * 
 * WSS Formula:
 * - Protocol: 25% (HTTPS = 100, HTTP = 0)
 * - Reputation: 25% (Clean = 100, Blacklisted = 0)
 * - Tracking: 20% (No trackers = 100, Many = 0)
 * - Cookies: 15% (No tracking cookies = 100, Many = 0)
 * - Inputs: 10% (No sensitive fields = 100, Password fields = lower)
 * - Policy: 5% (Good policy = 100, No policy = low)
 * 
 * Total weights: 100%
 */
export function calculateWSS(breakdown: ScoreBreakdown): number {
    // Validate all input scores
    const validatedBreakdown = {
        protocol: validateScore(breakdown.protocol),
        reputation: validateScore(breakdown.reputation),
        tracking: validateScore(breakdown.tracking),
        cookies: validateScore(breakdown.cookies),
        input: validateScore(breakdown.input),
        policy: validateScore(breakdown.policy)
    };

    // Check if policy is a neutral fallback score (50 = found link but no ToS;DR rating)
    // Score 25 (no privacy link) IS included as a known negative signal
    // Valid ToS;DR scores are: 20 (E), 40 (D), 60 (C), 80 (B), 100 (A)
    const isPolicyFallback = validatedBreakdown.policy === 50;

    // Base weights
    let weights = {
        protocol: 0.25,
        reputation: 0.25,
        tracking: 0.20,
        cookies: 0.15,
        input: 0.10,
        policy: 0.05
    };

    // If policy is fallback, exclude it and redistribute weight proportionally
    if (isPolicyFallback) {
        const policyWeight = weights.policy;
        weights.policy = 0;

        // Redistribute to other metrics proportionally
        const otherTotal = 1 - policyWeight;
        weights.protocol = weights.protocol / otherTotal;
        weights.reputation = weights.reputation / otherTotal;
        weights.tracking = weights.tracking / otherTotal;
        weights.cookies = weights.cookies / otherTotal;
        weights.input = weights.input / otherTotal;

        console.log(`[WSS] Policy excluded (fallback score ${validatedBreakdown.policy}) - weight redistributed`);
    }

    // Calculate weighted contributions
    const contributions = {
        protocol: validatedBreakdown.protocol * weights.protocol,
        reputation: validatedBreakdown.reputation * weights.reputation,
        tracking: validatedBreakdown.tracking * weights.tracking,
        cookies: validatedBreakdown.cookies * weights.cookies,
        input: validatedBreakdown.input * weights.input,
        policy: validatedBreakdown.policy * weights.policy
    };

    // Sum all contributions
    const totalWeightedScore =
        contributions.protocol +
        contributions.reputation +
        contributions.tracking +
        contributions.cookies +
        contributions.input +
        contributions.policy;

    const finalScore = validateScore(totalWeightedScore);

    // Tree-structured logging for transparency
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
    console.log(`└── Final WSS: ${finalScore} (${finalScore >= 80 ? '✅ Safe' : finalScore >= 60 ? '🔵 Low Risk' : finalScore >= 40 ? '🟡 Medium' : finalScore >= 20 ? '🟠 High Risk' : '🔴 Critical'})`);

    return finalScore;
}

/**
 * @deprecated Use calculateWSS instead. This alias exists for backward compatibility.
 */
export function calculateWRS(breakdown: ScoreBreakdown): number {
    console.warn('[Deprecation] calculateWRS is deprecated, use calculateWSS instead');
    return calculateWSS(breakdown);
}
