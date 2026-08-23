/**
 * =============================================================================
 * PII PENALTY SYSTEM TESTS - Automated Tests for Privacy Score Logic
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This test file verifies that the PII (Personally Identifiable Information)
 * penalty and recovery system works correctly. These tests ensure that:
 * 
 * TEST CATEGORIES:
 * 
 * 1. BASE_PENALTIES
 *    - Verifies that sensitive data types have appropriate penalties
 *    - SSN should have the highest penalty, name should have the lowest
 * 
 * 2. PII_PATTERNS
 *    - Tests regex patterns that detect PII formats
 *    - Email, phone, SSN, and credit card pattern matching
 * 
 * 3. calculatePIIPenalty
 *    - Tests how entering PII affects your privacy score
 *    - Verifies context multiplier based on site safety
 *    - Ensures score never goes below 0
 * 
 * 4. calculateRecovery
 *    - Tests how visiting safe sites restores your score
 *    - Verifies streak bonus every 10 safe visits
 *    - Ensures score never exceeds 100
 * 
 * 5. Integration Scenarios
 *    - Simulates realistic browsing sessions
 *    - Tests UPS decay through risky browsing
 *    - Tests UPS recovery through safe browsing
 * 
 * TO RUN THESE TESTS: npm run test
 * =============================================================================
 */
import { describe, it, expect } from 'vitest'
import {
    calculatePIIPenalty,
    calculateRecovery,
    calculateVisitImpact,
    calculateFocusPenalty,
    evaluatePIIEntry,
    PII_PATTERNS,
    BASE_PENALTIES,
    getBasePenalty,
} from './pii'

describe('PII Penalty System', () => {
    describe('BASE_PENALTIES', () => {
        it('should have highest penalty for SSN', () => {
            expect(BASE_PENALTIES.ssn).toBeGreaterThan(BASE_PENALTIES.password)
            expect(BASE_PENALTIES.ssn).toBe(10)
        })

        it('should have high penalty for credit card', () => {
            expect(BASE_PENALTIES.creditCard).toBe(9)
        })

        it('should have high penalty for password', () => {
            expect(BASE_PENALTIES.password).toBe(8)
        })

        it('should have medium penalty for phone', () => {
            expect(BASE_PENALTIES.phone).toBe(5)
        })

        it('should have medium penalty for email', () => {
            expect(BASE_PENALTIES.email).toBe(4)
        })

        it('should have low penalty for name', () => {
            expect(BASE_PENALTIES.name).toBe(1)
        })

        it('should map the detector "credit card" display string to the creditCard penalty', () => {
            expect(getBasePenalty('credit card')).toBe(9)
            expect(getBasePenalty('Credit Card')).toBe(9)
        })
    })

    describe('PII_PATTERNS', () => {
        it('should match valid email addresses', () => {
            const emailPattern = PII_PATTERNS.email
            expect(emailPattern.test('test@example.com')).toBe(true)
            expect(emailPattern.test('user.name@domain.co.uk')).toBe(true)
            expect(emailPattern.test('user+tag@gmail.com')).toBe(true)
        })

        it('should not match invalid email addresses', () => {
            const emailPattern = PII_PATTERNS.email
            expect(emailPattern.test('notanemail')).toBe(false)
            expect(emailPattern.test('missing@domain')).toBe(false)
        })

        it('should match US phone numbers', () => {
            const phonePattern = PII_PATTERNS.phone
            // Pattern matches: NNN-NNN-NNNN, NNN.NNN.NNNN, or NNNNNNNNNN
            expect(phonePattern.test('555-123-4567')).toBe(true)
            expect(phonePattern.test('555.123.4567')).toBe(true)
            expect(phonePattern.test('5551234567')).toBe(true)
        })

        it('should match SSN format with dashes', () => {
            const ssnPattern = PII_PATTERNS.ssn
            expect(ssnPattern.test('123-45-6789')).toBe(true)
            // Note: pattern requires dashes
            expect(ssnPattern.test('987-65-4321')).toBe(true)
        })

        it('should match credit card numbers', () => {
            const ccPattern = PII_PATTERNS.creditCard
            expect(ccPattern.test('4111111111111111')).toBe(true) // Visa test
            expect(ccPattern.test('4111-1111-1111-1111')).toBe(true)
            expect(ccPattern.test('4111 1111 1111 1111')).toBe(true)
        })
    })

    describe('calculatePIIPenalty', () => {
        it('should apply context multiplier based on site WSS', () => {
            const currentUPS = 100

            // On safe site (WSS 100): multiplier = 1 + (100-100)/100 = 1
            // Password base penalty = 8, final = 8 * 1 = 8
            const safeResult = calculatePIIPenalty(currentUPS, 'password', 100)
            expect(safeResult.penalty).toBe(8)
            expect(safeResult.newUPS).toBe(92)

            // On risky site (WSS 0): multiplier = 1 + (100-0)/100 = 2
            // Password base penalty = 8, final = 8 * 2 = 16
            const riskyResult = calculatePIIPenalty(currentUPS, 'password', 0)
            expect(riskyResult.penalty).toBe(16)
            expect(riskyResult.newUPS).toBe(84)
        })

        it('should apply higher penalty for SSN than email', () => {
            const currentUPS = 100
            const wss = 50 // Medium site

            const ssnResult = calculatePIIPenalty(currentUPS, 'ssn', wss)
            const emailResult = calculatePIIPenalty(currentUPS, 'email', wss)

            expect(ssnResult.penalty).toBeGreaterThan(emailResult.penalty)
        })

        it('should never reduce UPS below 0', () => {
            const currentUPS = 5
            const result = calculatePIIPenalty(currentUPS, 'ssn', 0) // Max penalty

            expect(result.newUPS).toBe(0)
            expect(result.newUPS).toBeGreaterThanOrEqual(0)
        })

        it('keeps a user already at UPS 0 at 0 instead of rebounding to a near-full score', () => {
            // Callers must pass the real UPS (never `|| 100`); a 0 base must
            // stay 0 after a penalty, not "recover" to ~90 via the fallback.
            const result = calculatePIIPenalty(0, 'ssn', 0) // Max penalty
            expect(result.newUPS).toBe(0)
        })

        it('should handle unknown field types with default penalty', () => {
            const currentUPS = 100
            const result = calculatePIIPenalty(currentUPS, 'unknown', 50)

            expect(result.penalty).toBeGreaterThan(0)
            expect(result.newUPS).toBeLessThan(100)
        })

        it('should clamp WSS to valid range', () => {
            const currentUPS = 100

            // WSS above 100 should be clamped
            const tooHighWSS = calculatePIIPenalty(currentUPS, 'email', 150)
            const maxWSS = calculatePIIPenalty(currentUPS, 'email', 100)
            expect(tooHighWSS.penalty).toBe(maxWSS.penalty)

            // WSS below 0 should be clamped
            const tooLowWSS = calculatePIIPenalty(currentUPS, 'email', -50)
            const minWSS = calculatePIIPenalty(currentUPS, 'email', 0)
            expect(tooLowWSS.penalty).toBe(minWSS.penalty)
        })
    })

    describe('calculateRecovery', () => {
        it('should not recover on risky sites (WSS < 70)', () => {
            const currentUPS = 80
            const result = calculateRecovery(currentUPS, 60, 5) // WSS 60 is risky

            expect(result.recovery).toBe(0)
            expect(result.newUPS).toBe(80)
        })

        it('should recover on safe sites (WSS >= 70)', () => {
            const currentUPS = 80
            const result = calculateRecovery(currentUPS, 85, 5, true)

            expect(result.recovery).toBeGreaterThan(0)
            expect(result.newUPS).toBeGreaterThan(80)
        })

        it('should recover more on very safe sites', () => {
            const currentUPS = 80

            const result70 = calculateRecovery(currentUPS, 70, 5, true)
            const result100 = calculateRecovery(currentUPS, 100, 5, true)

            expect(result100.recovery).toBeGreaterThan(result70.recovery)
        })

        it('should give bonus recovery every 10 streak visits', () => {
            const currentUPS = 80
            const wss = 85

            // Streak of 9 means after this visit streak becomes 10 (milestone!)
            const streak9 = calculateRecovery(currentUPS, wss, 9, true)
            // Streak of 8 means after this visit streak becomes 9 (no milestone)
            const streak8 = calculateRecovery(currentUPS, wss, 8, true)

            expect(streak9.recovery).toBeGreaterThan(streak8.recovery)
        })

        it('should never exceed UPS of 100', () => {
            const currentUPS = 99
            const result = calculateRecovery(currentUPS, 100, 100) // Maximum recovery

            expect(result.newUPS).toBeLessThanOrEqual(100)
        })

        it('should return streak bonus message on milestone', () => {
            // Start with streak of 9, reaching milestone of 10
            const result = calculateRecovery(80, 85, 9, true)
            expect(result.message.toLowerCase()).toContain('streak')
        })
    })

    describe('calculateVisitImpact', () => {
        it('should apply recovery for safe sites (WSS >= 70)', () => {
            const currentUPS = 80
            const result = calculateVisitImpact(currentUPS, 85, 5, true)

            expect(result.newUPS).toBeGreaterThanOrEqual(80)
            expect(result.newStreak).toBe(6) // Streak incremented
        })

        it('should apply penalty for risky sites (WSS < 70)', () => {
            const currentUPS = 80
            const result = calculateVisitImpact(currentUPS, 50, 5, true)

            expect(result.newUPS).toBeLessThanOrEqual(80)
            expect(result.newStreak).toBe(0) // Streak reset
        })

        it('should reset streak on risky site visit', () => {
            const result = calculateVisitImpact(80, 40, 15, true)

            expect(result.newStreak).toBe(0)
        })

        it('should increment streak on safe site visit', () => {
            const result = calculateVisitImpact(80, 90, 5, true)

            expect(result.newStreak).toBe(6)
        })
    })

    describe('evaluatePIIEntry (expected-use exemptions)', () => {
        it('penalizes password entry on a blacklisted login page (override wins)', () => {
            const result = evaluatePIIEntry({
                fieldType: 'password',
                domain: 'evil-login.com',
                siteWSS: 20,
                isBlacklisted: true,
                pageContext: { isLoginPage: true },
            });
            expect(result.penalize).toBe(true);
            expect(result.reason).toBe('blacklisted');
        });

        it('exempts one-time security codes on safe sites (ephemeral, single-use)', () => {
            const result = evaluatePIIEntry({
                fieldType: 'security code',
                domain: 'example.com',
                siteWSS: 80,
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('otp');
        });

        it('penalizes 2FA codes on risky non-blacklisted sites (OTP-scam catch)', () => {
            // We cannot verify where the code goes, so on a risky site the
            // OTP exemption does not apply - that's the OTP-scam scenario.
            const result = evaluatePIIEntry({
                fieldType: 'security code',
                domain: 'sketchy-login.xyz',
                siteWSS: 30,
            });
            expect(result.penalize).toBe(true);
            expect(result.reason).toBe('risky');
        });

        it('still penalizes 2FA codes on blacklisted sites (hard override)', () => {
            // Fake bank page asking for your 2FA code: the blacklist override
            // beats every exemption.
            const result = evaluatePIIEntry({
                fieldType: 'security code',
                domain: 'bank-secure-login.xyz',
                siteWSS: 20,
                isBlacklisted: true,
            });
            expect(result.penalize).toBe(true);
            expect(result.reason).toBe('blacklisted');
        });

        it('never penalizes PII on government domains', () => {
            const result = evaluatePIIEntry({
                fieldType: 'ssn',
                domain: 'dmv.ca.gov',
                siteWSS: 40,
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('government');
        });

        it('exempts login on a verified trusted platform (LinkedIn)', () => {
            // LinkedIn is on the verified trusted list, so logging in is safe
            // even though its WSS may be mediocre.
            const result = evaluatePIIEntry({
                fieldType: 'password',
                domain: 'linkedin.com',
                siteWSS: 55,
                pageContext: { isLoginPage: true },
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('trusted');
        });

        it('exempts login on a trusted platform subdomain', () => {
            const result = evaluatePIIEntry({
                fieldType: 'password',
                domain: 'accounts.google.com',
                siteWSS: 60,
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('trusted');
        });

        it('penalizes SSN on a trusted platform that has no business collecting it', () => {
            // LinkedIn is verified, but it's not a Tier 1 sector - an SSN ask
            // there is a red flag even though the site is trusted.
            const result = evaluatePIIEntry({
                fieldType: 'ssn',
                domain: 'linkedin.com',
                siteWSS: 90,
            });
            expect(result.penalize).toBe(true);
            expect(result.reason).toBe('unnecessary');
        });

        it('exempts payment details on a verified store (Amazon)', () => {
            const result = evaluatePIIEntry({
                fieldType: 'credit card',
                domain: 'amazon.com',
                siteWSS: 50,
                pageContext: { isCheckoutPage: true },
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('trusted');
        });

        it('penalizes card entry on a risky non-verified checkout (fake storefront)', () => {
            // We cannot verify the card reaches a safe checkout.
            const result = evaluatePIIEntry({
                fieldType: 'credit card',
                domain: 'shop.example',
                siteWSS: 45,
                pageContext: { isCheckoutPage: true },
            });
            expect(result.penalize).toBe(true);
            expect(result.reason).toBe('risky');
        });

        it('exempts PII on user-whitelisted sites', () => {
            const result = evaluatePIIEntry({
                fieldType: 'address',
                domain: 'small-local-shop.com',
                siteWSS: 40,
                isWhitelisted: true,
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('whitelisted');
        });

        it('exempts email entry on a safe site (expected use)', () => {
            const result = evaluatePIIEntry({
                fieldType: 'email',
                domain: 'newsletter.example',
                siteWSS: 85,
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('safe-site');
        });

        it('penalizes SSN entry on a safe site whose sector has no business asking', () => {
            // "IT website shouldn't need your SSN" - even if the site is safe.
            const result = evaluatePIIEntry({
                fieldType: 'ssn',
                domain: 'acmecoding.example',
                siteWSS: 90,
            });
            expect(result.penalize).toBe(true);
            expect(result.reason).toBe('unnecessary');
        });

        it('exempts SSN entry on a curated bank even on a risky site', () => {
            const result = evaluatePIIEntry({
                fieldType: 'ssn',
                domain: 'chase.com',
                siteWSS: 55,
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('curated-sector');
        });

        it('exempts SSN entry on a curated bank subdomain', () => {
            const result = evaluatePIIEntry({
                fieldType: 'ssn',
                domain: 'secure.chase.com',
                siteWSS: 60,
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('curated-sector');
        });

        it('does not let keyword facades exempt a risky site (fake insurance)', () => {
            // A sketchy site posing as an insurer: keywords alone are a weak
            // signal and must not grant an exemption on a risky site.
            const result = evaluatePIIEntry({
                fieldType: 'ssn',
                domain: 'quick-insurance-claims.xyz',
                siteWSS: 40,
            });
            expect(result.penalize).toBe(true);
            expect(result.reason).toBe('risky');
        });

        it('exempts keyword-matched sectors on safe sites', () => {
            const result = evaluatePIIEntry({
                fieldType: 'ssn',
                domain: 'myinsurancesite.com',
                siteWSS: 80,
            });
            expect(result.penalize).toBe(false);
            expect(result.reason).toBe('keyword-sector');
        });

        it('penalizes non-expected PII on risky non-blacklisted sites', () => {
            const result = evaluatePIIEntry({
                fieldType: 'address',
                domain: 'random-blog.example',
                siteWSS: 45,
            });
            expect(result.penalize).toBe(true);
            expect(result.reason).toBe('risky');
        });

        it('maps one-time codes to a small base penalty (risky OTP entry costs points)', () => {
            expect(getBasePenalty('security code')).toBe(3);
            expect(getBasePenalty('verification code')).toBe(3);
            expect(getBasePenalty('otp')).toBe(3);
        });
    });

    describe('calculateFocusPenalty', () => {
        it('should apply 20% of base penalty on focus', () => {
            const currentUPS = 100
            const wss = 50

            // Calculate what the full penalty would be
            const fullPenalty = calculatePIIPenalty(currentUPS, 'password', wss)
            const focusPenalty = calculateFocusPenalty(currentUPS, 'password', wss)

            // Focus penalty should be ~20% of full penalty (with rounding)
            expect(focusPenalty.penalty).toBeLessThan(fullPenalty.penalty)
            expect(focusPenalty.penalty).toBeGreaterThan(0)
        })

        it('should still apply context multiplier', () => {
            const currentUPS = 100

            const safeFocus = calculateFocusPenalty(currentUPS, 'password', 100)
            const riskyFocus = calculateFocusPenalty(currentUPS, 'password', 0)

            expect(riskyFocus.penalty).toBeGreaterThan(safeFocus.penalty)
        })
    })

    describe('Integration Scenarios', () => {
        it('should model UPS decay through a risky browsing session', () => {
            let ups = 100

            // Visit risky site (WSS 30)
            const visit1 = calculateVisitImpact(ups, 30, 0)
            ups = visit1.newUPS
            expect(ups).toBeLessThan(100)

            // Enter email on risky site
            const email1 = calculatePIIPenalty(ups, 'email', 30)
            ups = email1.newUPS
            expect(ups).toBeLessThan(visit1.newUPS)

            // Enter password on risky site
            const password1 = calculatePIIPenalty(ups, 'password', 30)
            ups = password1.newUPS
            expect(ups).toBeLessThan(email1.newUPS)

            // UPS should have dropped significantly
            expect(ups).toBeLessThan(80)
        })

        it('should model UPS recovery through safe browsing', () => {
            let ups = 70
            let streak = 0

            // Visit 15 safe sites
            for (let i = 0; i < 15; i++) {
                const result = calculateVisitImpact(ups, 95, streak, true)
                ups = result.newUPS
                streak = result.newStreak
            }

            // Should have recovered significantly
            expect(ups).toBeGreaterThan(70)
            expect(streak).toBe(15)
        })
    })
})
