/**
 * =============================================================================
 * WEBSITE SAFETY SCORE (WSS) TESTS - Automated Tests for Scoring Algorithm
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This test file verifies that the Website Safety Score (WSS) calculation
 * works correctly. The WSS combines 6 detector scores into one overall score.
 * 
 * TEST CATEGORIES:
 * 
 * 1. Basic Calculation
 *    - Perfect scores (all 100) should produce WSS of 100
 *    - Worst scores (all 0) should produce WSS of 0
 *    - Weighted average calculation is correct
 * 
 * 2. Score Validation
 *    - Scores above 100 are clamped to 100
 *    - Negative scores are clamped to 0
 *    - NaN values fallback to 50
 * 
 * 3. Policy Fallback Handling
 *    - Policy score of 50 (neutral) is excluded from calculation
 *    - Policy scores of 25 or 20 are included as penalties
 * 
 * 4. Weight Distribution
 *    - Reputation: 30%
 *    - Tracking: 30%
 *    - Cookies: 20%
 *    - Input: 15%
 *    - Policy: 5%
 * 
 * 5. Real-World Scenarios
 *    - Safe site (like Google): ~79 WSS
 *    - Risky site (HTTP with trackers): ~50 WSS
 *    - Malicious site (blacklisted): ~8 WSS
 * 
 * TO RUN THESE TESTS: npm run test
 * =============================================================================
 */
import { describe, it, expect } from 'vitest'
import { calculateWSS } from './scoring'
import type { ScoreBreakdown } from './types'

describe('calculateWSS', () => {
    describe('Basic Calculation', () => {
        it('should return 100 for perfect scores on all detectors', () => {
            const breakdown: ScoreBreakdown = {
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 100,
            }
            expect(calculateWSS(breakdown)).toBe(100)
        })

        it('should return 0 for worst scores on all detectors', () => {
            const breakdown: ScoreBreakdown = {
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            expect(calculateWSS(breakdown)).toBe(0)
        })

        it('should calculate weighted average correctly', () => {
            // Reputation: 100 * 0.30 = 30
            // Tracking: 50 * 0.30 = 15
            // Cookies: 50 * 0.20 = 10
            // Input: 50 * 0.15 = 7.5
            // Policy: 100 * 0.05 = 5
            // Total = 67.5 ≈ 68
            const breakdown: ScoreBreakdown = {
                reputation: 100,
                tracking: 50,
                cookies: 50,
                input: 50,
                policy: 100,
            }
            expect(calculateWSS(breakdown)).toBe(68)
        })
    })

    describe('Score Validation', () => {
        it('should clamp scores above 100 to 100', () => {
            const breakdown: ScoreBreakdown = {
                reputation: 150, // Invalid, should clamp to 100
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 100,
            }
            expect(calculateWSS(breakdown)).toBe(100)
        })

        it('should clamp negative scores to 0', () => {
            const breakdown: ScoreBreakdown = {
                reputation: -50, // Invalid, should clamp to 0
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 100,
            }
            // Reputation: 0 * 0.30 = 0
            // Others: 30 + 20 + 15 + 5 = 70
            expect(calculateWSS(breakdown)).toBe(70)
        })

        it('should handle NaN by treating as fallback (50)', () => {
            const breakdown: ScoreBreakdown = {
                reputation: NaN, // Should fallback to 50
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 100,
            }
            // Reputation: 50 * 0.30 = 15
            // Others: 30 + 20 + 15 + 5 = 70
            // Total = 15 + 70 = 85
            expect(calculateWSS(breakdown)).toBe(85)
        })
    })

    describe('Policy Fallback Handling', () => {
        it('should exclude policy score of 50 (neutral fallback) and redistribute weight', () => {
            // When policy is 50 (fallback), its weight is redistributed
            const breakdown: ScoreBreakdown = {
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 50, // Fallback - should be excluded
            }
            // Policy excluded, other weights scaled up
            // Result should still be 100 since all others are 100
            expect(calculateWSS(breakdown)).toBe(100)
        })

        it('should include policy score of 25 (no privacy link) as a penalty', () => {
            // Score 25 means no privacy link found - this is a known negative, not fallback
            const breakdown: ScoreBreakdown = {
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 25, // No privacy link - should be included
            }
            // 100*0.30 + 100*0.30 + 100*0.20 + 100*0.15 + 25*0.05
            // = 30 + 30 + 20 + 15 + 1.25 = 96.25 ≈ 96
            expect(calculateWSS(breakdown)).toBe(96)
        })

        it('should include ToS;DR grade E (score 20) as a penalty', () => {
            const breakdown: ScoreBreakdown = {
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 20, // ToS;DR grade E
            }
            // 100*0.30 + 100*0.30 + 100*0.20 + 100*0.15 + 20*0.05
            // = 30 + 30 + 20 + 15 + 1 = 96
            expect(calculateWSS(breakdown)).toBe(96)
        })
    })

    describe('Weight Distribution', () => {
        it('should weight reputation at 30%', () => {
            const baseline: ScoreBreakdown = {
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withReputation: ScoreBreakdown = { ...baseline, reputation: 100 }
            expect(calculateWSS(withReputation)).toBe(30)
        })

        it('should weight tracking at 30%', () => {
            const baseline: ScoreBreakdown = {
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withTracking: ScoreBreakdown = { ...baseline, tracking: 100 }
            expect(calculateWSS(withTracking)).toBe(30)
        })

        it('should weight cookies at 20%', () => {
            const baseline: ScoreBreakdown = {
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withCookies: ScoreBreakdown = { ...baseline, cookies: 100 }
            expect(calculateWSS(withCookies)).toBe(20)
        })

        it('should weight input at 15%', () => {
            const baseline: ScoreBreakdown = {
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withInput: ScoreBreakdown = { ...baseline, input: 100 }
            expect(calculateWSS(withInput)).toBe(15)
        })

        it('should weight policy at 5%', () => {
            const baseline: ScoreBreakdown = {
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withPolicy: ScoreBreakdown = { ...baseline, policy: 100 }
            expect(calculateWSS(withPolicy)).toBe(5)
        })
    })

    describe('Real-World Scenarios', () => {
        it('should score a typical safe site correctly (Google)', () => {
            // Clean reputation, some trackers, some cookies, login form, good policy
            const breakdown: ScoreBreakdown = {
                reputation: 100, // Clean
                tracking: 65,   // Some trackers
                cookies: 70,    // Some tracking cookies
                input: 50,      // Password field (login)
                policy: 80,     // Grade B
            }
            // 100*0.30 + 65*0.30 + 70*0.20 + 50*0.15 + 80*0.05
            // = 30 + 19.5 + 14 + 7.5 + 4 = 75
            expect(calculateWSS(breakdown)).toBe(75)
        })

        it('should score a risky site correctly (unknown site with trackers)', () => {
            const breakdown: ScoreBreakdown = {
                reputation: 100, // Unknown (defaults safe)
                tracking: 30,   // Many trackers
                cookies: 40,    // Many tracking cookies
                input: 60,      // Some forms
                policy: 25,     // No privacy link
            }
            // 100*0.30 + 30*0.30 + 40*0.20 + 60*0.15 + 25*0.05
            // = 30 + 9 + 8 + 9 + 1.25 = 57.25 ≈ 57
            expect(calculateWSS(breakdown)).toBe(57)
        })

        it('should score a malicious site correctly (blacklisted)', () => {
            const breakdown: ScoreBreakdown = {
                reputation: 0,  // Blacklisted!
                tracking: 10,   // Many trackers
                cookies: 20,    // Many bad cookies
                input: 30,      // Many sensitive inputs
                policy: 0,      // ToS;DR grade F
            }
            // 0*0.30 + 10*0.30 + 20*0.20 + 30*0.15 + 0*0.05
            // = 0 + 3 + 4 + 4.5 + 0 = 11.5 ≈ 12
            expect(calculateWSS(breakdown)).toBe(12)
        })
    })
})
