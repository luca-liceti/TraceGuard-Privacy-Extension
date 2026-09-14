/**
 * =============================================================================
 * TRACKER ENRICHER TESTS
 * =============================================================================
 *
 * Covers:
 * - DOM trackers are filtered: only domains our databases recognize as actual
 *   trackers make it into the list (CDNs / fonts / APIs are excluded).
 * - Organization resolution: Disconnect entity name, then Tracker Radar owner,
 *   then Radar display name.
 * - Category resolution from Tracker Radar and Disconnect, into our own closed
 *   vocabulary: a category this build does not know becomes 'unknown' rather
 *   than leaking the raw database string.
 * - Network requests get the same org fallback chain.
 *
 * The database loader fetches assets via chrome.runtime.getURL + fetch, so we
 * stub globalThis.fetch with small fixtures mirroring the real asset shapes.
 * vi.resetModules() before each test gives fresh module-level DB caches.
 * =============================================================================
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fixtures (shapes mirror the real bundled assets)
// ---------------------------------------------------------------------------
const trackerRadarFixture = {
    'google-analytics.com': { owner: 'Google LLC', displayName: 'Google', category: 'Analytics', prevalence: 0.75, fingerprinting: 0 },
    'doubleclick.net': { owner: 'Google LLC', displayName: 'Google Ads', category: 'Advertising', prevalence: 0.6, fingerprinting: 0 },
    'cdn.example-fonts.com': { owner: null, displayName: null, category: null, prevalence: 0, fingerprinting: 0 },
    // Radar names a product where Disconnect names the parent. This is the case
    // the precedence rule exists for.
    'both.example': { owner: 'Brand Product', displayName: 'Brand', category: 'Marketing', prevalence: 0.4, fingerprinting: 0 },
    // Radar-only, so its broad "Marketing" grouping is the only signal.
    'radar-marketing.example': { owner: 'Marketing Co', displayName: 'Marketing Co', category: 'Marketing', prevalence: 0.3, fingerprinting: 0 },
};

const easyPrivacyFixture = ['unknown-pixel.net', 'cloudfront.net'];

const disconnectFixture = {
    // google-analytics.com deliberately NOT here so the Tracker Radar test
    // exercises the Radar category path without Disconnect overriding it.
    'adnxs.com': { category: 'Advertising', entityName: 'AppNexus' },
    'both.example': { category: 'Analytics', entityName: 'Both Databases Ltd' },
    // The categories Disconnect ships that used to fall through as raw strings.
    'consent.example': { category: 'ConsentManagers', entityName: 'OneTrust' },
    'antifraud.example': { category: 'Anti-fraud', entityName: 'FraudGuard' },
    'email.example': { category: 'EmailAggressive', entityName: 'MailCo' },
    'fp.example': { category: 'FingerprintingGeneral', entityName: 'FingerCo' },
    // A category from a future database version, which must not reach the UI.
    'newness.example': { category: 'SomethingNew', entityName: 'Weird Ltd' },
};

const cookieDbFixture = { exact: {}, wildcards: [] };

function stubAssetFetch() {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
        const name = String(url).split('/').pop();
        const bodies: Record<string, unknown> = {
            'tracker-radar.json': trackerRadarFixture,
            'easyprivacy-domains.json': easyPrivacyFixture,
            'disconnect-services.json': disconnectFixture,
            'cookie-database.json': cookieDbFixture,
        };
        const body = bodies[name || ''];
        if (!body) throw new Error(`Unexpected asset fetch: ${name}`);
        return { ok: true, json: async () => body } as Response;
    }));
}

beforeEach(() => {
    vi.resetModules(); // Fresh module-level DB caches per test
    stubAssetFetch();
});

describe('enrichTrackers', () => {
    it('excludes third-party domains that are not recognized trackers', async () => {
        const { enrichTrackers } = await import('./tracker-enricher');
        const result = await enrichTrackers(
            'https://example.com/',
            [
                { url: 'https://cdn.jsdelivr.net/npm/script.js', type: 'script', domain: 'cdn.jsdelivr.net' },
                { url: 'https://fonts.example-cdn.com/font.woff2', type: 'script', domain: 'fonts.example-cdn.com' },
            ],
            {}
        );
        expect(result).toHaveLength(0);
    });

    it('never counts generic CDN / cloud-hosting domains as trackers, even when a blocklist flags them', async () => {
        // EasyPrivacy lists cloudfront.net because SOME trackers ride it, but a
        // legit site serving assets from CloudFront / S3 must not be flagged -
        // that would drag the WSS down and trigger unfair PII penalties.
        const { enrichTrackers } = await import('./tracker-enricher');
        const result = await enrichTrackers(
            'https://example.com/',
            [
                { url: 'https://d1abc.cloudfront.net/img.png', type: 'image', domain: 'd1abc.cloudfront.net' },
                { url: 'https://s3.amazonaws.com/bucket/file.js', type: 'script', domain: 's3.amazonaws.com' },
            ],
            {}
        );
        expect(result).toHaveLength(0);
    });

    it('attributes organization and category from Tracker Radar (with parent-domain match)', async () => {
        const { enrichTrackers } = await import('./tracker-enricher');
        const result = await enrichTrackers(
            'https://example.com/',
            [{ url: 'https://www.google-analytics.com/ga.js', type: 'script', domain: 'www.google-analytics.com' }],
            {}
        );
        expect(result).toHaveLength(1);
        expect(result[0].domain).toBe('www.google-analytics.com');
        expect(result[0].organization).toBe('Google LLC');
        expect(result[0].category).toBe('analytics');
    });

    it('falls back to the Disconnect entity name when Tracker Radar lacks the domain', async () => {
        const { enrichTrackers } = await import('./tracker-enricher');
        const result = await enrichTrackers(
            'https://example.com/',
            [{ url: 'https://adnxs.com/pixel.png', type: 'pixel', domain: 'adnxs.com' }],
            {}
        );
        expect(result).toHaveLength(1);
        expect(result[0].organization).toBe('AppNexus');
        expect(result[0].category).toBe('advertising');
    });

    it('prefers the Disconnect entity name when both databases know the domain', async () => {
        const { enrichTrackers } = await import('./tracker-enricher');
        const result = await enrichTrackers(
            'https://example.com/',
            [{ url: 'https://both.example/t.js', type: 'script', domain: 'both.example' }],
            {}
        );
        expect(result).toHaveLength(1);
        expect(result[0].organization).toBe('Both Databases Ltd');
        expect(result[0].category).toBe('analytics');
    });

    it('maps a Radar-only Marketing category to advertising, not unknown', async () => {
        const { enrichTrackers } = await import('./tracker-enricher');
        const result = await enrichTrackers(
            'https://example.com/',
            [{ url: 'https://radar-marketing.example/t.js', type: 'script', domain: 'radar-marketing.example' }],
            {}
        );
        expect(result[0].category).toBe('advertising');
    });

    it('keeps trackers that only appear in EasyPrivacy (no org, unknown category)', async () => {
        const { enrichTrackers } = await import('./tracker-enricher');
        const result = await enrichTrackers(
            'https://example.com/',
            [{ url: 'https://unknown-pixel.net/t.png', type: 'pixel', domain: 'unknown-pixel.net' }],
            {}
        );
        expect(result).toHaveLength(1);
        expect(result[0].domain).toBe('unknown-pixel.net');
        expect(result[0].organization).toBeNull();
    });

    it('enriches network requests with the same org fallback chain', async () => {
        const { enrichTrackers } = await import('./tracker-enricher');
        const networkRequests = {
            'https://adnxs.com/pixel.png': {
                url: 'https://adnxs.com',
                domain: 'adnxs.com',
                resourceType: 'image',
                organization: null,
                isTracker: true,
                isThirdParty: true,
                status: 'completed',
                blockedReason: null,
                timestamp: 1,
            },
            'https://api.example.com/data': {
                url: 'https://api.example.com',
                domain: 'api.example.com',
                resourceType: 'fetch',
                organization: null,
                isTracker: false,
                isThirdParty: true,
                status: 'completed',
                blockedReason: null,
                timestamp: 2,
            },
        };
        const result = await enrichTrackers('https://example.com/', [], networkRequests as any);
        expect(result).toHaveLength(1);
        expect(result[0].domain).toBe('adnxs.com');
        expect(result[0].organization).toBe('AppNexus');
        expect(result[0].source).toBe('network');
    });
});

describe('getDisconnectCategory', () => {
    it.each([
        ['consent.example', 'consent'],
        ['antifraud.example', 'anti-fraud'],
        ['email.example', 'email'],
        ['fp.example', 'fingerprinting'],
    ])('maps %s to %s', async (domain, expected) => {
        const { getDisconnectCategory } = await import('./database-loader');
        expect(await getDisconnectCategory(domain)).toBe(expected);
    });

    it('reports unknown rather than leaking a category this build does not know', async () => {
        const { getDisconnectCategory } = await import('./database-loader');
        expect(await getDisconnectCategory('newness.example')).toBe('unknown');
    });

    it('returns null when Disconnect has no entry for the domain', async () => {
        const { getDisconnectCategory } = await import('./database-loader');
        expect(await getDisconnectCategory('totally-unknown.example')).toBeNull();
    });
});

describe('getDisconnectEntity', () => {
    it('returns the entity name for a direct match', async () => {
        const { getDisconnectEntity } = await import('./database-loader');
        expect(await getDisconnectEntity('adnxs.com')).toBe('AppNexus');
    });

    it('resolves parent domains', async () => {
        const { getDisconnectEntity } = await import('./database-loader');
        expect(await getDisconnectEntity('static.adnxs.com')).toBe('AppNexus');
    });

    it('returns null for unknown domains', async () => {
        const { getDisconnectEntity } = await import('./database-loader');
        expect(await getDisconnectEntity('totally-unknown.example')).toBeNull();
    });
});
