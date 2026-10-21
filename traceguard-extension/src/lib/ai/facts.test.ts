import { describe, expect, it } from 'vitest';
import type { PIIDetectionEvent, SiteRiskData } from '../types';
import { buildLogSummaryRequest, buildSiteSummaryRequest } from './facts';

function makeSite(domain: string, visitCount: number, wss: number): SiteRiskData {
    return {
        domain,
        wss,
        breakdown: { reputation: 90, tracking: 35, cookies: 55, fingerprinting: 70, input: 45, policy: 40 },
        lastAnalyzed: 1,
        visitCount,
        detectionDetails: {
            tracking: { count: 4, known: 3, suspicious: 1 },
            cookies: { total: 8, tracking: 5, thirdParty: 6 },
            input: { total: 2, sensitive: 1, types: ['email'] },
            policy: {
                grade: 'C',
                source: 'tosdr',
                points: [
                    { classification: 'blocker', title: 'The service can share account data with advertisers.' },
                    { classification: 'good', title: 'You can delete your account.' },
                ],
            },
        },
        enrichedDetails: {
            trackers: {
                items: [{ url: 'https://tracker.invalid/pixel?user=secret', domain: 'tracker.invalid' } as never],
                summary: { total: 4, active: 4, blockedByBrowser: 0, byCategory: { advertising: 2, analytics: 2 } },
            },
            cookies: { items: [{ name: 'session-secret', domain: domain } as never], summary: { total: 8, active: 8, blockedByBrowser: 0, byCategory: { marketing: 5 } } },
            fingerprinting: {
                items: [{ technique: 'canvas', detected: true, scriptDomain: 'tracker.invalid', organization: null, description: 'reads canvas rendering', risk: 'high' }],
                summary: { totalAttempts: 2, techniques: ['canvas', 'webgl'], riskLevel: 'high' },
            },
            headers: {
                items: [{ header: 'Content-Security-Policy', value: null, present: false, rating: 'missing', explanation: 'Restricts script sources', recommendation: 'Set a policy.' }],
                summary: { score: 50, present: 2, missing: 4, grade: 'D' },
            },
        } as never,
    };
}

const handover = (site: string, siteWSS: number, scoreImpact: number): PIIDetectionEvent => ({
    timestamp: 1,
    site,
    fieldType: 'email',
    sensitivity: 'MEDIUM',
    siteWSS,
    scoreImpact,
});

// A site with every finding present and a long domain: the domain, score, and
// findings share one 300-character fact, so the audit has to fit what is left.
function makeBusySite(domain: string): SiteRiskData {
    const site = makeSite(domain, 4, 12);
    return {
        ...site,
        detectionDetails: {
            ...site.detectionDetails,
            tracking: { count: 999_999, known: 888_888, suspicious: 111_111 },
            cookies: { total: 888_888, tracking: 555_555, thirdParty: 666_666 },
        },
        enrichedDetails: {
            ...site.enrichedDetails,
            trackers: {
                items: [],
                summary: { total: 999_999, active: 999_999, blockedByBrowser: 0, byCategory: { advertising: 222, analytics: 222, social: 111 } },
            },
            cookies: {
                items: [],
                summary: { total: 888_888, active: 888_888, blockedByBrowser: 0, byCategory: { marketing: 555, analytics: 333, advertising: 222 } },
            },
            fingerprinting: {
                items: [],
                summary: { totalAttempts: 999_999, techniques: ['canvas', 'webgl', 'audio'], riskLevel: 'high' },
            },
        } as never,
    };
}

describe('summary audit fact builders', () => {
    it('builds a site audit from stored adverse findings and explains why they matter without sending raw data', () => {
        const request = buildSiteSummaryRequest(makeSite('example.com', 5, 42));
        expect(request.subject).toBe('site');
        expect(request.subjectName).toBe('example.com');
        expect(request.facts).toContainEqual({ label: 'Website Safety Score (higher is safer)', value: '42/100 (fair)' });
        expect(request.facts).toContainEqual({ label: 'Detector score: tracking (lower means more concern)', value: '35/100 (poor)' });
        expect(request.facts).toContainEqual({ label: 'Tracker evidence (observed requests, not proof of data use)', value: '4 observed; 3 matched to known trackers; 1 suspicious or unclassified; categories: advertising 2, analytics 2' });
        expect(request.facts).toContainEqual({ label: 'Fingerprinting evidence (an attempt does not prove identification)', value: '2 attempts; high risk; techniques: canvas, webgl' });
        expect(request.facts).toContainEqual({ label: 'Security-header evidence (missing defense is not proof of an attack)', value: 'grade D; 4 missing; including Content-Security-Policy' });
        expect(request.facts.some(item => item.value.includes('The service can share account data with advertisers.'))).toBe(true);

        const serialized = JSON.stringify(request);
        expect(serialized).not.toContain('secret');
        expect(serialized).not.toContain('tracker.invalid');
        expect(serialized).not.toContain('crossSiteExposure');
        expect(serialized).not.toContain('email');
        expect(serialized).not.toContain('You can delete your account.');
    });

    it('builds a balanced Overview audit from site evidence and aggregated handover patterns', () => {
        const cache = Object.fromEntries(Array.from({ length: 7 }, (_, index) => {
            const site = makeSite(`site${index}.example`, index, 40 + index * 9);
            return [site.domain, site];
        }));
        const entries = [
            handover('site6.example', 94, -2),
            handover('site6.example', 94, -1),
            handover('site0.example', 40, -4),
            handover('site1.example', 49, 0),
        ];
        const request = buildLogSummaryRequest(cache, entries)!;
        expect(request.subject).toBe('log');
        expect(request.subjectName).toContain('recorded');
        expect(request.facts.find(item => item.label === 'Distinct analyzed sites')?.value).toBe('7');
        expect(request.facts.find(item => item.label === 'Recorded personal-info form entries (not proof of submission; field names and values excluded)')?.value).toBe('4');
        expect(request.facts.find(item => item.label.startsWith('Cross-site tracking audit'))?.value).toBe('7 below 60/100; 0 at least 80/100');
        expect(request.facts.some(item => item.value.includes('site0.example: 2 entries'))).toBe(false);
        expect(request.facts.some(item => item.value.includes('site6.example: 2 entries on pages averaging 94/100 safety; 3 score points deducted'))).toBe(true);
        expect(request.facts.some(item => item.label.startsWith('Lowest-scoring analyzed site') && item.value.includes('adverse policy point: The service can share account data with advertisers.'))).toBe(true);

        const serialized = JSON.stringify(request);
        expect(serialized).not.toContain('email');
        expect(serialized).not.toContain('timestamp');
        expect(serialized).not.toContain('session-secret');
        expect(serialized).not.toContain('tracker.invalid');
        expect(serialized).not.toContain('https://');
    });

    it('keeps every fact inside the local summarizer limits for a busy site with a long domain', () => {
        const domain = 'www.some-long-subdomain.accounting.example.co.uk';
        const request = buildLogSummaryRequest({ [domain]: makeBusySite(domain) }, [handover(domain, 12, -3)])!;

        expect(request.facts.length).toBeLessThanOrEqual(32);
        for (const fact of request.facts) {
            expect(fact.label.length).toBeLessThanOrEqual(100);
            expect(fact.value.length).toBeLessThanOrEqual(300);
        }

        // The audit shares the fact with the domain and score, so it has to keep
        // whole findings within what is left instead of overrunning the limit.
        const worst = request.facts.find(item => item.label.startsWith('Lowest-scoring analyzed site'))!;
        expect(worst.value.startsWith(`${domain}: 12/100 (critical); trackers 999999`)).toBe(true);
        expect(worst.value.length).toBeLessThanOrEqual(300);

        expect(buildSiteSummaryRequest(makeBusySite(domain)).facts.every(item => item.value.length <= 300)).toBe(true);
    });

    it('returns no log audit when no sites have been analyzed', () => {
        expect(buildLogSummaryRequest({})).toBeNull();
    });
});
