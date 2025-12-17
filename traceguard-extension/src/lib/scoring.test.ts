import { describe, it, expect } from 'vitest'
import { calculateWSS } from './scoring'
import type { ScoreBreakdown } from './types'

describe('calculateWSS', () => {
    describe('Basic Calculation', () => {
        it('should return 100 for perfect scores on all detectors', () => {
            const breakdown: ScoreBreakdown = {
                protocol: 100,
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
                protocol: 0,
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            expect(calculateWSS(breakdown)).toBe(0)
        })

        it('should calculate weighted average correctly', () => {
            // Protocol: 100 * 0.25 = 25
            // Reputation: 100 * 0.25 = 25
            // Tracking: 50 * 0.20 = 10
            // Cookies: 50 * 0.15 = 7.5
            // Input: 50 * 0.10 = 5
            // Policy: 100 * 0.05 = 5
            // Total = 77.5 ≈ 78
            const breakdown: ScoreBreakdown = {
                protocol: 100,
                reputation: 100,
                tracking: 50,
                cookies: 50,
                input: 50,
                policy: 100,
            }
            expect(calculateWSS(breakdown)).toBe(78)
        })
    })

    describe('Score Validation', () => {
        it('should clamp scores above 100 to 100', () => {
            const breakdown: ScoreBreakdown = {
                protocol: 150, // Invalid, should clamp to 100
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 100,
            }
            expect(calculateWSS(breakdown)).toBe(100)
        })

        it('should clamp negative scores to 0', () => {
            const breakdown: ScoreBreakdown = {
                protocol: -50, // Invalid, should clamp to 0
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 100,
            }
            // Protocol: 0 * 0.25 = 0
            // Others: same as above
            // 0 + 25 + 20 + 15 + 10 + 5 = 75
            expect(calculateWSS(breakdown)).toBe(75)
        })

        it('should handle NaN by treating as fallback (50)', () => {
            const breakdown: ScoreBreakdown = {
                protocol: NaN, // Should fallback to 50
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 100,
            }
            // Protocol: 50 * 0.25 = 12.5
            // Others: 25 + 20 + 15 + 10 + 5 = 75
            // Total = 12.5 + 75 = 87.5 ≈ 88
            expect(calculateWSS(breakdown)).toBe(88)
        })
    })

    describe('Policy Fallback Handling', () => {
        it('should exclude policy score of 50 (neutral fallback) and redistribute weight', () => {
            // When policy is 50 (fallback), its weight is redistributed
            const breakdown: ScoreBreakdown = {
                protocol: 100,
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
                protocol: 100,
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 25, // No privacy link - should be included
            }
            // 100*0.25 + 100*0.25 + 100*0.20 + 100*0.15 + 100*0.10 + 25*0.05
            // = 25 + 25 + 20 + 15 + 10 + 1.25 = 96.25 ≈ 96
            expect(calculateWSS(breakdown)).toBe(96)
        })

        it('should include ToS;DR grade E (score 20) as a penalty', () => {
            const breakdown: ScoreBreakdown = {
                protocol: 100,
                reputation: 100,
                tracking: 100,
                cookies: 100,
                input: 100,
                policy: 20, // ToS;DR grade E
            }
            // 100*0.25 + 100*0.25 + 100*0.20 + 100*0.15 + 100*0.10 + 20*0.05
            // = 25 + 25 + 20 + 15 + 10 + 1 = 96
            expect(calculateWSS(breakdown)).toBe(96)
        })
    })

    describe('Weight Distribution', () => {
        it('should weight protocol at 25%', () => {
            const baseline: ScoreBreakdown = {
                protocol: 0,
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withProtocol: ScoreBreakdown = { ...baseline, protocol: 100 }
            expect(calculateWSS(withProtocol)).toBe(25)
        })

        it('should weight reputation at 25%', () => {
            const baseline: ScoreBreakdown = {
                protocol: 0,
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withReputation: ScoreBreakdown = { ...baseline, reputation: 100 }
            expect(calculateWSS(withReputation)).toBe(25)
        })

        it('should weight tracking at 20%', () => {
            const baseline: ScoreBreakdown = {
                protocol: 0,
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withTracking: ScoreBreakdown = { ...baseline, tracking: 100 }
            expect(calculateWSS(withTracking)).toBe(20)
        })

        it('should weight cookies at 15%', () => {
            const baseline: ScoreBreakdown = {
                protocol: 0,
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withCookies: ScoreBreakdown = { ...baseline, cookies: 100 }
            expect(calculateWSS(withCookies)).toBe(15)
        })

        it('should weight input at 10%', () => {
            const baseline: ScoreBreakdown = {
                protocol: 0,
                reputation: 0,
                tracking: 0,
                cookies: 0,
                input: 0,
                policy: 0,
            }
            const withInput: ScoreBreakdown = { ...baseline, input: 100 }
            expect(calculateWSS(withInput)).toBe(10)
        })

        it('should weight policy at 5%', () => {
            const baseline: ScoreBreakdown = {
                protocol: 0,
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
            // HTTPS, clean reputation, some trackers, some cookies, login form, good policy
            const breakdown: ScoreBreakdown = {
                protocol: 100,  // HTTPS
                reputation: 100, // Clean
                tracking: 65,   // Some trackers
                cookies: 70,    // Some tracking cookies
                input: 50,      // Password field (login)
                policy: 80,     // Grade B
            }
            // 100*0.25 + 100*0.25 + 65*0.20 + 70*0.15 + 50*0.10 + 80*0.05
            // = 25 + 25 + 13 + 10.5 + 5 + 4 = 82.5 ≈ 83
            expect(calculateWSS(breakdown)).toBe(83)
        })

        it('should score a risky site correctly (unknown HTTP site with trackers)', () => {
            const breakdown: ScoreBreakdown = {
                protocol: 0,    // HTTP
                reputation: 100, // Unknown (defaults safe)
                tracking: 30,   // Many trackers
                cookies: 40,    // Many tracking cookies
                input: 60,      // Some forms
                policy: 25,     // No privacy link
            }
            // 0*0.25 + 100*0.25 + 30*0.20 + 40*0.15 + 60*0.10 + 25*0.05
            // = 0 + 25 + 6 + 6 + 6 + 1.25 = 44.25 ≈ 44
            expect(calculateWSS(breakdown)).toBe(44)
        })

        it('should score a malicious site correctly (blacklisted)', () => {
            const breakdown: ScoreBreakdown = {
                protocol: 0,    // HTTP
                reputation: 0,  // Blacklisted!
                tracking: 10,   // Many trackers
                cookies: 20,    // Many bad cookies
                input: 30,      // Many sensitive inputs
                policy: 0,      // ToS;DR grade F
            }
            // 0*0.25 + 0*0.25 + 10*0.20 + 20*0.15 + 30*0.10 + 0*0.05
            // = 0 + 0 + 2 + 3 + 3 + 0 = 8
            expect(calculateWSS(breakdown)).toBe(8)
        })
    })
})
