/**
 * =============================================================================
 * PII SECTOR TESTS - Site-Purpose Necessity Detection
 * =============================================================================
 *
 * Verifies the sector/necessity model used by evaluatePIIEntry:
 * - Government TLD detection
 * - Curated verified-domain matching (strong signal)
 * - Keyword heuristics (weak signal)
 * - Tier 1 data necessity mapping
 * =============================================================================
 */
import { describe, it, expect } from 'vitest'
import {
    isGovernmentDomain,
    isTrustedDomain,
    getSiteSector,
    sectorNeedsField,
    isHighTierField,
    isSecurityCodeField,
} from './pii-sectors'

describe('isGovernmentDomain', () => {
    it('recognizes US government subdomains', () => {
        expect(isGovernmentDomain('dmv.ca.gov')).toBe(true);
        expect(isGovernmentDomain('irs.gov')).toBe(true);
    });

    it('recognizes foreign government TLDs', () => {
        expect(isGovernmentDomain('gov.uk')).toBe(true);
        expect(isGovernmentDomain('service-public.gouv.fr')).toBe(true);
        expect(isGovernmentDomain('moj.go.jp')).toBe(true);
    });

    it('recognizes education domains (financial aid collects SSNs)', () => {
        expect(isGovernmentDomain('stanford.edu')).toBe(true);
    });

    it('does not match lookalike or non-government domains', () => {
        expect(isGovernmentDomain('notgov.com')).toBe(false);
        expect(isGovernmentDomain('gov.com')).toBe(false);
        expect(isGovernmentDomain('example.org')).toBe(false);
        expect(isGovernmentDomain('www.linkedin.com')).toBe(false);
    });
});

describe('isTrustedDomain', () => {
    it('matches major consumer platforms', () => {
        expect(isTrustedDomain('linkedin.com')).toBe(true);
        expect(isTrustedDomain('google.com')).toBe(true);
        expect(isTrustedDomain('amazon.com')).toBe(true);
        expect(isTrustedDomain('apple.com')).toBe(true);
    });

    it('matches subdomains of trusted platforms', () => {
        expect(isTrustedDomain('accounts.google.com')).toBe(true);
        expect(isTrustedDomain('www.linkedin.com')).toBe(true);
        expect(isTrustedDomain('signin.ebay.com')).toBe(true);
    });

    it('rejects lookalike domains', () => {
        expect(isTrustedDomain('linkedin-secure.xyz')).toBe(false);
        expect(isTrustedDomain('google.com.evil.example')).toBe(false);
        expect(isTrustedDomain('notamazon.org')).toBe(false);
    });
});

describe('getSiteSector', () => {
    it('matches curated domains exactly', () => {
        expect(getSiteSector('chase.com')).toEqual({ sector: 'banking', source: 'curated' });
        expect(getSiteSector('statefarm.com')).toEqual({ sector: 'insurance', source: 'curated' });
        expect(getSiteSector('coinbase.com')).toEqual({ sector: 'fintech', source: 'curated' });
    });

    it('matches curated domain subdomains', () => {
        expect(getSiteSector('secure.chase.com')).toEqual({ sector: 'banking', source: 'curated' });
        expect(getSiteSector('www.fidelity.com')).toEqual({ sector: 'investing', source: 'curated' });
    });

    it('matches sector keywords as a weak signal', () => {
        expect(getSiteSector('myinsurancesite.com')).toEqual({ sector: 'insurance', source: 'keyword' });
        expect(getSiteSector('greatbankonline.com')).toEqual({ sector: 'banking', source: 'keyword' });
    });

    it('returns null for unknown sites', () => {
        expect(getSiteSector('acmecoding.example')).toBeNull();
        expect(getSiteSector('random-blog.com')).toBeNull();
    });

    it('prefers curated over keyword when both match', () => {
        // "coin" matches the fintech keyword, but coinbase is verified.
        expect(getSiteSector('coinbase.com')).toEqual({ sector: 'fintech', source: 'curated' });
    });
});

describe('sectorNeedsField', () => {
    it('allows Tier 1 sectors to collect SSNs', () => {
        expect(sectorNeedsField('banking', 'ssn')).toBe(true);
        expect(sectorNeedsField('insurance', 'ssn')).toBe(true);
        expect(sectorNeedsField('healthcare', 'ssn')).toBe(true);
        expect(sectorNeedsField('fintech', 'ssn')).toBe(true);
    });

    it('allows any sector to collect contact data', () => {
        expect(sectorNeedsField('banking', 'email')).toBe(true);
        expect(sectorNeedsField('insurance', 'address')).toBe(true);
        expect(sectorNeedsField('telecom', 'phone')).toBe(true);
    });

    it('flags SSN as high-tier data', () => {
        expect(isHighTierField('ssn')).toBe(true);
        expect(isHighTierField('SSN')).toBe(true);
        expect(isHighTierField('email')).toBe(false);
        expect(isHighTierField('password')).toBe(false);
    });

    it('recognizes security-code field types', () => {
        expect(isSecurityCodeField('security code')).toBe(true);
        expect(isSecurityCodeField('otp')).toBe(true);
        expect(isSecurityCodeField('verification code')).toBe(true);
        expect(isSecurityCodeField('password')).toBe(false);
    });
});
