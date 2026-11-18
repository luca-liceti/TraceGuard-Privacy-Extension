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
 * 1. Reputation (25%): Is this domain on a local blacklist?
 * 2. Tracking (25%): How many third-party trackers are following you?
 * 3. Cookies (15%): Are there tracking or advertising cookies?
 * 4. Fingerprinting (15%): Are scripts attempting to identify the device?
 * 5. Inputs (10%): Are there sensitive fields like password or credit card?
 * 6. Policy (10%): What does the privacy policy say (according to ToS;DR)?
 * 
 * EXAMPLE:
 * If a site has:
 * - Good reputation: 100 × 25% = 25
 * - Some trackers: 60 × 25% = 15
 * - Few cookies: 80 × 15% = 12
 * - A canvas fingerprinting attempt: 70 × 15% = 10.5
 * - Login form: 65 × 10% = 6.5
 * - Policy exists but ToS;DR has no rating: 50, excluded, and its 10% weight
 *   is redistributed
 * Those five contributions total 69. Excluding policy rescales them by 1 / 0.9,
 * so the reported WSS is 69 / 0.9 = 77 (generally safe), not 69.
 *
 * A missing policy is different. If no privacy policy is found at all, the
 * policy detector scores 25 and that score STAYS in the WSS at full 10% weight.
 * Absence of a policy is a red flag, not an unknown, so it must never read as
 * neutral or improve a site's score.
 * =============================================================================
 */

import { ScoreBreakdown } from './types';
import { logEvent } from './diagnostics';

export const WSS_WEIGHTS = {
    reputation: 0.25,
    tracking: 0.25,
    cookies: 0.15,
    fingerprinting: 0.15,
    input: 0.10,
    policy: 0.10,
} as const;

/**
 * A policy link exists, but ToS;DR has no rating for it. Neutral: the policy
 * score is excluded and its weight is redistributed. This is the ONLY policy
 * value that is excluded.
 */
export const POLICY_UNRATED_SCORE = 50;

/** No privacy policy was found at all. A red flag, included at full weight. */
export const POLICY_MISSING_SCORE = 25;

/**
 * A site with no privacy policy at all cannot read as "Excellent".
 *
 * Its 10% weight alone only costs 2.5 points, so a page that loads no trackers
 * scored 93 ("Excellent"). That is exactly the profile of a fresh phishing
 * page: nothing to track you with, and no policy to read. The cap keeps the
 * best band for sites that at least publish a policy.
 */
export const MAX_WSS_WITHOUT_POLICY = 79;

/**
 * A page served over plain HTTP cannot read as safe.
 *
 * Credentials and card numbers entered on an unencrypted page are readable by
 * anyone on the network. Its detector scores can still be perfect, so the cap
 * is applied to the total rather than to one detector.
 */
export const MAX_WSS_WITHOUT_HTTPS = 49;

/** Facts about the page that are not detector scores. */
export interface WssContext {
    /** False when the page was served over plain HTTP. Omit when unknown. */
    secure?: boolean;
}

const FINGERPRINTING_WEIGHTS: Record<string, number> = {
    canvas: 5, webgl: 4, audio: 3, font: 2, navigator: 1,
    webrtc: 3, screen: 1, battery: 1,
};

/** Converts observed fingerprinting techniques into a 0-100 safety score. */
export function calculateFingerprintingScore(techniques: readonly string[]): number {
    const weightedTechniques = [...new Set(techniques)].reduce(
        (total, technique) => total + (FINGERPRINTING_WEIGHTS[technique] ?? 1), 0,
    );
    return validateScore(100 - 12 * Math.log2(weightedTechniques + 1));
}

/**
 * Converts a count of unique third-party tracker domains into a 0-100 safety
 * score (higher = fewer trackers). Uses the same logarithmic decay as the
 * tracking detector so a handful of trackers is penalized sharply while
 * additional ones contribute a diminishing penalty.
 *
 * Examples:
 * - 0 trackers  -> 100
 * - 1 tracker   -> ~61
 * - 5 trackers  -> ~39
 * - 20 trackers -> ~34
 */
export function calculateTrackingScore(trackerCount: number): number {
    const count = Number.isFinite(trackerCount) ? Math.max(0, Math.floor(trackerCount)) : 0;
    if (count === 0) return 100;
    return validateScore(100 - 15 * Math.log2(count + 1));
}

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
        // A missing or NaN score silently becomes a neutral fallback, which hides
        // a detector that never returned a value. This used to be a console.warn
        // nobody had open.
        logEvent('scoring', 'warn', 'invalid_score_fallback', `Invalid score replaced with fallback ${fallback}`, {
            received: String(score),
            fallback,
        });
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
 * The audit trail behind a WSS: which weights were actually applied, what each
 * detector contributed, and the final rounded total. Exported so a diagnostics
 * bundle can explain a score instead of merely reporting it.
 */
export interface WssExplanation {
    validated: ScoreBreakdown;
    policyFallback: boolean;
    weights: Record<keyof ScoreBreakdown, number>;
    contributions: Record<keyof ScoreBreakdown, number>;
    total: number;
    /**
     * The ceiling each missing piece of evidence applied, or null when it did
     * not apply. The score is the smallest of the weighted total and these.
     */
    caps: {
        https: number | null;
        policy: number | null;
    };
}

/**
 * Explains the Website Safety Score (WSS) for a website: the weights that were
 * applied, each detector's contribution, and the final total. This holds the
 * only implementation of the scoring math, so a score and its audit trail can
 * never disagree.
 * 
 * This is the main function that takes scores from all 6 detectors and
 * combines them into a single overall score. Think of it like calculating
 * a weighted average for a class - some tests count more than others!
 * 
 * @param breakdown - An object containing scores from each detector
 * @returns The overall Website Safety Score (0-100)
 */
export function explainWSS(breakdown: ScoreBreakdown, context: WssContext = {}): WssExplanation {
    // STEP 1: Validate all input scores to ensure they're usable
    // This prevents weird bugs from invalid numbers
    const validatedBreakdown = {
        reputation: validateScore(breakdown.reputation),
        tracking: validateScore(breakdown.tracking),
        cookies: validateScore(breakdown.cookies),
        fingerprinting: validateScore(breakdown.fingerprinting),
        input: validateScore(breakdown.input),
        policy: validateScore(breakdown.policy)
    };

    // STEP 2: Check if the policy score is the neutral "not rated" sentinel.
    // 50 means "we found a privacy link but ToS;DR has no rating", so we exclude
    // it rather than penalizing an unrated policy. A missing policy scores 25
    // and is deliberately NOT excluded: no policy is a red flag, not neutral.
    const isPolicyFallback = validatedBreakdown.policy === POLICY_UNRATED_SCORE;

    // STEP 3: Define the weights for each detector
    // These add up to 100% (1.0)
    const weights: Record<keyof typeof WSS_WEIGHTS, number> = {
        ...WSS_WEIGHTS
    };

    // STEP 4: If policy is a fallback, redistribute its weight to other detectors
    // This ensures the total still adds up to 100%
    if (isPolicyFallback) {
        const policyWeight = weights.policy;
        weights.policy = 0;  // Policy contributes 0

        // We divide each weight by (1 - policyWeight) to scale them up
        const otherTotal = 1 - policyWeight;
        weights.reputation = weights.reputation / otherTotal;
        weights.tracking = weights.tracking / otherTotal;
        weights.cookies = weights.cookies / otherTotal;
        weights.fingerprinting = weights.fingerprinting / otherTotal;
        weights.input = weights.input / otherTotal;

    }

    // STEP 5: Calculate how much each detector contributes to the final score
    // contribution = detector_score × detector_weight
    const contributions = {
        reputation: validatedBreakdown.reputation * weights.reputation,
        tracking: validatedBreakdown.tracking * weights.tracking,
        cookies: validatedBreakdown.cookies * weights.cookies,
        fingerprinting: validatedBreakdown.fingerprinting * weights.fingerprinting,
        input: validatedBreakdown.input * weights.input,
        policy: validatedBreakdown.policy * weights.policy
    };

    // STEP 6: Add up all contributions to get the final score
    const totalWeightedScore =
        contributions.reputation +
        contributions.tracking +
        contributions.cookies +
        contributions.fingerprinting +
        contributions.input +
        contributions.policy;

    // Validate the weighted total (round it and ensure it's 0-100)
    const weightedTotal = validateScore(totalWeightedScore);

    // Two pieces of evidence are not detector scores but still bound what the
    // score may claim: plain HTTP, and no policy at all. A cap can only lower
    // the score. The audit trail records both so a capped score is explainable.
    const caps = {
        https: context.secure === false ? MAX_WSS_WITHOUT_HTTPS : null,
        policy: validatedBreakdown.policy === POLICY_MISSING_SCORE ? MAX_WSS_WITHOUT_POLICY : null,
    };
    const capValues = [caps.https, caps.policy].filter((value): value is number => value !== null);
    const total = capValues.length > 0
        ? Math.min(weightedTotal, ...capValues)
        : weightedTotal;

    return {
        validated: validatedBreakdown,
        policyFallback: isPolicyFallback,
        weights,
        contributions,
        total,
        caps,
    };
}

/**
 * The Website Safety Score (0-100) for a website. Thin wrapper over
 * `explainWSS`, which owns the math.
 */
export function calculateWSS(breakdown: ScoreBreakdown, context: WssContext = {}): number {
    return explainWSS(breakdown, context).total;
}
