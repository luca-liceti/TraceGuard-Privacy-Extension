/**
 * =============================================================================
 * PII DETECTION & UPS CALCULATION - Privacy Score System
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file holds the per-handover cost table and the expected-use exemptions
 * that decide whether a handover is penalized. The User Privacy Score itself is
 * derived from the handover record in lib/ups.ts; this file never scores a
 * visit.
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
 * HANDOVER COST (only handovers move the derived score):
 *   cost = base sensitivity x (1 + (100 - WSS) / 100), decayed with age
 *   - Password on a safe site: base 8, multiplier 1.0
 *   - Password on a risky site: base 8, multiplier up to 2.0
 * Expected use (login, 2FA, checkout on a safe or verified site) is exempt.
 * Visits contribute nothing; there is no visit penalty and no streak bonus.
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

import { getSiteSector, isGovernmentDomain, isHighTierField, isSecurityCodeField, isTrustedDomain, sectorNeedsField, normalizeFieldType } from './pii-sectors';
import { logEvent } from './diagnostics';

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

    // One-time codes (2FA / OTP) - ephemeral, but entering them on a risky
    // site is the classic OTP-scam vector, so they cost a little when the
    // site can't be trusted (exempted on verified/safe sites).
    securityCode: 3,
    otp: 3,

    // Default for unknown types
    unknown: 3
};

/**
 * Get base penalty for a field type
 */
export function getBasePenalty(fieldType: string): number {
    // Normalize to a canonical key. Detectors emit display strings such as
    // "credit card"; collapse whitespace and alias them onto the penalty map.
    const normalizedType = fieldType.toLowerCase().replace(/\s+/g, '');
    const aliases: Record<string, string> = {
        creditcard: 'creditCard',
        card: 'creditCard',
        cvv: 'creditCard',
        securitycode: 'securityCode',
        'one-timecode': 'securityCode',
        verificationcode: 'securityCode',
        otp: 'securityCode',
        socialsecurity: 'ssn',
    };
    const key = aliases[normalizedType] || normalizedType;
    // Use ?? so a legitimate zero penalty (security codes) isn't replaced by
    // the unknown-type fallback.
    return BASE_PENALTIES[key] ?? BASE_PENALTIES.unknown;
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

    logEvent('pii', 'debug', 'pii_penalty', 'PII entry penalty calculated', {
        fieldType,
        basePenalty,
        siteWSS,
        clampedWSS,
        contextMultiplier: Math.round(contextMultiplier * 100) / 100,
        penalty,
        currentUPS,
        newUPS,
        riskLevel,
    });

    return { penalty, newUPS, message };
}

// ============================================================================
// PII ENTRY EVALUATION (Expected-Use Exemptions)
// ============================================================================

/**
 * Sites with a WSS at or above this threshold are "safe": entering personal
 * info there is treated as expected use and is not penalized.
 */
export const SAFE_WSS_THRESHOLD = 70;

/** Field types that are expected on a login/sign-up page. */
const LOGIN_FIELDS: ReadonlySet<string> = new Set(['password', 'email', 'username']);

/** Field types that are expected on a checkout/payment page. */
const CHECKOUT_FIELDS: ReadonlySet<string> = new Set(['creditcard', 'address']);

export interface PIIEntryContext {
    fieldType: string;
    domain: string;
    siteWSS: number;
    /** Reputation score 0 = on a blacklist. Hard override for all exemptions. */
    isBlacklisted?: boolean;
    /** Domain is on the user's whitelist (they vouched for it). */
    isWhitelisted?: boolean;
    pageContext?: {
        isLoginPage?: boolean;
        isCheckoutPage?: boolean;
    };
}

export type PIIEntryReason =
    | 'blacklisted'      // Penalize: site is on a blacklist, exemptions never apply
    | 'risky'            // Penalize: risky site - we can't verify where the data goes
    | 'unnecessary'      // Penalize: site has no business collecting this data
    | 'whitelisted'      // Exempt: user explicitly vouched for this site
    | 'otp'              // Exempt: one-time codes are ephemeral (verified/safe site)
    | 'government'       // Exempt: government sites legally require this data
    | 'login'            // Exempt: logging in is expected on this page (safe site)
    | 'checkout'         // Exempt: payment details are expected at checkout (safe site)
    | 'curated-sector'   // Exempt: verified site's sector needs this data
    | 'trusted'          // Exempt: verified consumer platform (login/2FA/checkout)
    | 'keyword-sector'   // Exempt: keyword-matched sector needs this data (safe site)
    | 'safe-site';       // Exempt: safe site, expected use

export interface PIIEntryDecision {
    penalize: boolean;
    reason: PIIEntryReason;
    /** Human-readable explanation, for notifications and the dashboard. */
    message: string;
}

/**
 * Decides whether entering a piece of personal info should cost UPS points.
 *
 * The UPS measures *avoidable* exposure, not normal internet use. Entering
 * your password on a login page, a 2FA code, or your SSN on a government or
 * bank site is expected use and never penalized - unless the site is on a
 * blacklist, in which case every exemption is overridden (that's the
 * phishing case we want to catch hard).
 *
 * Exemptions are earned by EVIDENCE OF LEGITIMACY, never by page structure
 * alone: we cannot look at a page and prove where a 2FA code or credit card
 * actually goes. So expected-use exemptions (login, 2FA, checkout) only apply
 * on sites we can vouch for - verified domains or demonstrably safe sites.
 * On risky sites, every sensitive entry is penalized, because that's exactly
 * where the OTP-scam and fake-checkout scenarios live.
 *
 * Order, strongest first:
 * 1. Blacklisted sites     -> always penalize (hard override)
 * 2. Government domains    -> never penalize (legally required)
 * 3. User-whitelisted      -> never penalize (user vouched for the site)
 * 4. Verified domains (curated sectors + trusted platforms):
 *    exempt expected use, except Tier 1 data (e.g. SSN) the sector has no
 *    business collecting -> penalize
 * 5. Safe sites (WSS >= 70): expected use exempt (login/2FA/checkout), with
 *    the SSN red-flag rule and keyword-sector exemptions
 * 6. Everything on risky sites (WSS < 70, not blacklisted, not verified,
 *    not whitelisted) -> penalize, no exemptions
 */
export function evaluatePIIEntry(ctx: PIIEntryContext): PIIEntryDecision {
    const fieldType = normalizeFieldType(ctx.fieldType);

    // 1. Hard override: blacklisted sites are always penalized, no exceptions.
    if (ctx.isBlacklisted) {
        return {
            penalize: true,
            reason: 'blacklisted',
            message: 'This site is flagged as dangerous - entering personal info here is risky.',
        };
    }

    // 2. Government domains legally require sensitive data.
    if (isGovernmentDomain(ctx.domain)) {
        return {
            penalize: false,
            reason: 'government',
            message: 'Government sites require this data - no penalty.',
        };
    }

    // 3. The user explicitly vouched for this site.
    if (ctx.isWhitelisted) {
        return {
            penalize: false,
            reason: 'whitelisted',
            message: 'This site is on your allow list - no penalty.',
        };
    }

    // 4. Verified domains: curated sectors and trusted consumer platforms.
    //    We verified the domain, so data submitted there reaches the real
    //    company - expected use is exempt. The one exception: Tier 1 data
    //    (e.g. SSN) that the site's sector has no business collecting.
    const sector = getSiteSector(ctx.domain);
    const isVerified = (sector && sector.source === 'curated') || isTrustedDomain(ctx.domain);
    if (isVerified) {
        const sectorNeeds = sector ? sectorNeedsField(sector.sector, fieldType) : false;
        if (isHighTierField(fieldType) && !sectorNeeds) {
            return {
                penalize: true,
                reason: 'unnecessary',
                message: 'This type of site has no business asking for this data.',
            };
        }
        if (sector && sector.source === 'curated') {
            return {
                penalize: false,
                reason: 'curated-sector',
                message: 'This verified site needs this data for its service - no penalty.',
            };
        }
        return {
            penalize: false,
            reason: 'trusted',
            message: 'This site is verified - entering this is expected use, no penalty.',
        };
    }

    // 5. Safe sites (WSS >= 70): demonstrably hard for scammers to fake
    //    (clean reputation, minimal trackers, good security headers).
    if (ctx.siteWSS >= SAFE_WSS_THRESHOLD) {
        const sectorNeeds = sector ? sectorNeedsField(sector.sector, fieldType) : false;

        // Red flag: Tier 1 data the sector has no business collecting.
        if (isHighTierField(fieldType) && !sectorNeeds) {
            return {
                penalize: true,
                reason: 'unnecessary',
                message: 'This type of site has no business asking for this data.',
            };
        }

        // Keyword-matched sector (weak signal is enough when the site itself
        // is already safe).
        if (sector && sector.source === 'keyword' && sectorNeeds) {
            return {
                penalize: false,
                reason: 'keyword-sector',
                message: 'This type of site needs this data - no penalty.',
            };
        }

        const pageContext = ctx.pageContext || {};

        // One-time security codes are ephemeral and single-use.
        if (isSecurityCodeField(fieldType)) {
            return {
                penalize: false,
                reason: 'otp',
                message: 'One-time security codes expire quickly - no penalty.',
            };
        }

        // Logging in is expected wherever there's a login form.
        if (pageContext.isLoginPage && LOGIN_FIELDS.has(fieldType)) {
            return {
                penalize: false,
                reason: 'login',
                message: 'Logging in is expected on this page - no penalty.',
            };
        }

        // Payment details are expected at checkout.
        if (pageContext.isCheckoutPage && CHECKOUT_FIELDS.has(fieldType)) {
            return {
                penalize: false,
                reason: 'checkout',
                message: 'Payment details are expected at checkout - no penalty.',
            };
        }

        return {
            penalize: false,
            reason: 'safe-site',
            message: 'Safe site - entering this is expected use, no penalty.',
        };
    }

    // 6. Risky site (WSS < 70), not blacklisted, not verified, not
    //    whitelisted: we have NO evidence the data reaches the right place,
    //    so every sensitive entry is penalized - including 2FA codes and
    //    checkout fields, which is where OTP scams and fake storefronts live.
    return {
        penalize: true,
        reason: 'risky',
        message: isSecurityCodeField(fieldType)
            ? 'We cannot verify where this one-time code goes - entering it on a risky site is dangerous.'
            : 'We cannot verify this site is safe - avoid entering personal info here.',
    };
}

