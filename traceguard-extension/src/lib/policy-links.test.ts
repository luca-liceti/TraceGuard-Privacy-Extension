import { describe, expect, it } from 'vitest';
import {
    MAX_POLICY_CANDIDATES,
    documentUrls,
    policyCandidates,
    probeUrls,
    rankPolicyLinks,
} from './policy-links';

const page = 'https://example.com/about';

describe('rankPolicyLinks', () => {
    it('puts a labelled privacy policy link first', () => {
        const ranked = rankPolicyLinks([
            { href: '/terms', text: 'Terms of service' },
            { href: '/legal/privacy-policy', text: 'Privacy Policy' },
            { href: '/cookies', text: 'Cookie policy' },
        ], page);
        expect(ranked[0]).toBe('https://example.com/legal/privacy-policy');
    });

    it('skips same-page anchors, non-http links, and PDFs', () => {
        const ranked = rankPolicyLinks([
            { href: '#privacy', text: 'Privacy policy' },
            { href: 'javascript:void(0)', text: 'Privacy policy' },
            { href: 'https://example.com/privacy.pdf', text: 'Privacy policy' },
            { href: '/privacy', text: 'Privacy policy' },
        ], page);
        expect(ranked).toEqual(['https://example.com/privacy']);
    });

    it('drops an off-site link that is not labelled as a policy', () => {
        const ranked = rankPolicyLinks([
            { href: 'https://unrelated.example.net/legal', text: 'Legal' },
        ], page);
        expect(ranked).toEqual([]);
    });

    it('keeps a policy hosted on a sibling domain when the label says so', () => {
        const ranked = rankPolicyLinks([
            { href: 'https://policies.example.com/privacy', text: 'Privacy Policy' },
        ], page);
        expect(ranked).toEqual(['https://policies.example.com/privacy']);
    });

    it('de-duplicates the same path reached two ways', () => {
        const ranked = rankPolicyLinks([
            { href: '/privacy', text: 'Privacy Policy' },
            { href: '/privacy/', text: 'Privacy' },
            { href: 'https://example.com/privacy#top', text: 'Privacy' },
        ], page);
        expect(ranked).toEqual(['https://example.com/privacy']);
    });

    it('caps how many candidates it returns', () => {
        const ranked = rankPolicyLinks(
            Array.from({ length: 12 }, (_, index) => ({ href: `/privacy-policy-${index}`, text: 'Privacy policy' })),
            page,
        );
        expect(ranked).toHaveLength(MAX_POLICY_CANDIDATES);
    });

    it('returns nothing for an unusable page URL', () => {
        expect(rankPolicyLinks([{ href: '/privacy' }], 'not a url')).toEqual([]);
    });
});

describe('documentUrls', () => {
    it('keeps usable documents in order and de-duplicates them', () => {
        expect(documentUrls([
            { url: 'https://example.com/privacy' },
            { url: 'https://example.com/privacy' },
            { url: 'ftp://example.com/privacy' },
            { url: 'https://example.com/terms' },
        ])).toEqual(['https://example.com/privacy', 'https://example.com/terms']);
    });

    it('tolerates a missing document list', () => {
        expect(documentUrls(undefined)).toEqual([]);
    });
});

describe('probeUrls', () => {
    it('probes the site origin with privacy paths first', () => {
        const probes = probeUrls('https://example.com/about');
        expect(probes[0]).toBe('https://example.com/privacy');
        expect(probes).toContain('https://example.com/privacy-policy');
        expect(probes.every(url => url.startsWith('https://example.com/'))).toBe(true);
    });
});

describe('policyCandidates', () => {
    it('prefers ToS;DR documents over page links', () => {
        expect(policyCandidates({
            pageUrl: page,
            documents: [{ url: 'https://example.com/policies/privacy' }],
            links: [{ href: '/privacy-policy', text: 'Privacy Policy' }],
        })[0]).toBe('https://example.com/policies/privacy');
    });

    it('probes only when the page offered nothing', () => {
        const probes = policyCandidates({ pageUrl: page, links: [] });
        expect(probes[0]).toBe('https://example.com/privacy');

        const mixed = policyCandidates({ pageUrl: page, links: [{ href: '/legal/privacy', text: 'Privacy' }] });
        expect(mixed).toEqual(['https://example.com/legal/privacy']);
    });
});
