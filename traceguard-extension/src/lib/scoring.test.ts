import { describe, expect, it } from 'vitest';
import { calculateFingerprintingScore, calculateTrackingScore, calculateWSS, explainWSS, POLICY_MISSING_SCORE, POLICY_UNRATED_SCORE } from './scoring';
import type { ScoreBreakdown } from './types';

const perfect: ScoreBreakdown = {
    reputation: 100, tracking: 100, cookies: 100, fingerprinting: 100, input: 100, policy: 100,
};

describe('calculateWSS', () => {
    it('returns 100 and 0 for perfect and worst complete breakdowns', () => {
        expect(calculateWSS(perfect)).toBe(100);
        expect(calculateWSS({ ...perfect, reputation: 0, tracking: 0, cookies: 0, fingerprinting: 0, input: 0, policy: 0 })).toBe(0);
    });

    it('uses the documented 25/25/15/15/10/10 weights', () => {
        expect(calculateWSS({ ...perfect, reputation: 0, tracking: 0, cookies: 0, fingerprinting: 0, input: 0, policy: 0 })).toBe(0);
        expect(calculateWSS({ ...perfect, tracking: 0 })).toBe(75);
        expect(calculateWSS({ ...perfect, fingerprinting: 0 })).toBe(85);
        expect(calculateWSS({ ...perfect, policy: 0 })).toBe(90);
    });

    it('redistributes the policy weight when ToS;DR has no rating', () => {
        expect(calculateWSS({ ...perfect, policy: POLICY_UNRATED_SCORE })).toBe(100);
        expect(calculateWSS({ ...perfect, tracking: 0, policy: POLICY_UNRATED_SCORE })).toBe(72);
    });

    it('keeps a missing policy in the score as a red flag', () => {
        // No policy (25) must lower the score at full weight. Only the
        // "policy exists but is unrated" sentinel (50) is neutral and excluded.
        expect(calculateWSS({ ...perfect, policy: POLICY_MISSING_SCORE })).toBe(93);
        expect(calculateWSS({ ...perfect, policy: POLICY_MISSING_SCORE }))
            .toBeLessThan(calculateWSS({ ...perfect, policy: POLICY_UNRATED_SCORE }));
        expect(calculateWSS({ ...perfect, policy: POLICY_MISSING_SCORE }))
            .toBeLessThan(calculateWSS({ ...perfect, policy: 100 }));
    });

    it('clamps invalid scores and treats missing legacy fingerprinting as neutral', () => {
        expect(calculateWSS({ ...perfect, reputation: 150, tracking: -1, fingerprinting: undefined })).toBe(68);
    });
});

/**
 * `explainWSS` is what a diagnostics bundle reports, so it has to agree with the
 * score the UI shows. These cases pin that agreement, including the policy
 * weight redistribution, which is the one place the arithmetic gets subtle.
 */
describe('explainWSS', () => {
    it('reports the weights and contributions behind a score', () => {
        const explanation = explainWSS({ ...perfect, tracking: 0 });

        expect(explanation.total).toBe(calculateWSS({ ...perfect, tracking: 0 }));
        expect(explanation.policyFallback).toBe(false);
        expect(explanation.weights.tracking).toBeCloseTo(0.25);
        expect(explanation.contributions.tracking).toBe(0);
        // Contributions sum to the total before rounding.
        const sum = Object.values(explanation.contributions).reduce((total, value) => total + value, 0);
        expect(sum).toBeCloseTo(explanation.total, 0);
    });

    it('flags the policy fallback and redistributes its weight', () => {
        const explanation = explainWSS({ ...perfect, policy: POLICY_UNRATED_SCORE });

        expect(explanation.policyFallback).toBe(true);
        expect(explanation.weights.policy).toBe(0);
        // The remaining weights scale up so the weights still sum to 100%.
        const weightSum = Object.values(explanation.weights).reduce((total, value) => total + value, 0);
        expect(weightSum).toBeCloseTo(1, 5);
        expect(explanation.total).toBe(100);
    });

    it('keeps the missing-policy score at full weight instead of excluding it', () => {
        const explanation = explainWSS({ ...perfect, policy: POLICY_MISSING_SCORE });

        expect(explanation.policyFallback).toBe(false);
        expect(explanation.weights.policy).toBeCloseTo(0.10);
        expect(explanation.contributions.policy).toBeCloseTo(2.5);
    });

    it('agrees with calculateWSS for every combination of reputation and policy', () => {
        for (const reputation of [0, 45, 100]) {
            for (const policy of [POLICY_MISSING_SCORE, POLICY_UNRATED_SCORE, 70, 100]) {
                const breakdown = { ...perfect, reputation, tracking: 30, policy };
                expect(calculateWSS(breakdown)).toBe(explainWSS(breakdown).total);
            }
        }
    });
});

describe('calculateFingerprintingScore', () => {
    it('penalizes detected techniques logarithmically', () => {
        expect(calculateFingerprintingScore([])).toBe(100);
        expect(calculateFingerprintingScore(['canvas'])).toBeLessThan(100);
        expect(calculateFingerprintingScore(['canvas', 'webgl', 'audio'])).toBeLessThan(calculateFingerprintingScore(['canvas']));
    });
});

describe('calculateTrackingScore', () => {
    it('scores a clean page at 100', () => {
        expect(calculateTrackingScore(0)).toBe(100);
    });

    it('penalizes more tracker domains with diminishing returns', () => {
        expect(calculateTrackingScore(1)).toBeLessThan(100);
        expect(calculateTrackingScore(5)).toBeLessThan(calculateTrackingScore(1));
        expect(calculateTrackingScore(20)).toBeLessThanOrEqual(calculateTrackingScore(5));
    });

    it('clamps to a valid 0-100 range for extreme inputs', () => {
        expect(calculateTrackingScore(-5)).toBe(100); // non-positive -> clean
        expect(calculateTrackingScore(Number.NaN)).toBe(100);
        const huge = calculateTrackingScore(1_000_000);
        expect(huge).toBeGreaterThanOrEqual(0);
        expect(huge).toBeLessThanOrEqual(100);
    });
});
