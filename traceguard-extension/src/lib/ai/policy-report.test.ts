import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POLICY_REPORT_PROMPT_VERSION, numberSentences, ratePrivacyPolicyLocally } from './policy-report';

const text = `Privacy Policy\n${'We collect personal data to provide our services. You may request deletion of your information. '.repeat(12)}`;
const response = (content: string) => new Response(JSON.stringify({ message: { content } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
});
const selection = (points: unknown[], summary = 'The policy describes collection and deletion rights.') =>
    response(JSON.stringify({ summary, points }));
const verification = (checks: Array<{ caseId: string; verdict: string }>) =>
    response(JSON.stringify({ checks }));

beforeEach(() => {
    vi.stubGlobal('chrome', { runtime: { getURL: () => 'moz-extension://traceguard/manifest.json' } });
    vi.stubGlobal('window', { location: { origin: 'moz-extension://traceguard', protocol: 'moz-extension:', hostname: 'traceguard' } });
});

describe('numberSentences', () => {
    it('splits a policy into numbered, non-trivial sentences', () => {
        const sentences = numberSentences('We collect personal data. You may delete your data at any time. Short.');
        expect(sentences[0]).toBe('We collect personal data.');
        expect(sentences[1]).toBe('You may delete your data at any time.');
        expect(sentences).toHaveLength(2);
    });
});

describe('ratePrivacyPolicyLocally', () => {
    it('resolves confirmed sentences and derives the score from the cases', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(selection([
                { caseId: 'deletion-right', sentence: 2, confidence: 0.9 },
                { caseId: 'data-shared', sentence: 3, confidence: 0.7 },
            ]))
            .mockResolvedValueOnce(verification([
                { caseId: 'deletion-right', verdict: 'supported' },
                { caseId: 'data-shared', verdict: 'supported' },
            ]));
        vi.stubGlobal('fetch', fetchMock);

        const result = await ratePrivacyPolicyLocally({
            url: 'https://example.com/privacy-policy',
            title: 'Privacy Policy',
            text,
            model: 'qwen3.5:9b',
        });

        // good (+8) and bad (-10) from the neutral 50
        expect(result.score).toBe(48);
        expect(result.grade).toBe('D');
        expect(result.points).toHaveLength(2);
        expect(result.points[0]).toMatchObject({
            caseId: 'deletion-right',
            classification: 'good',
            quote: 'You may request deletion of your information.',
        });
        expect(result.evidence).toEqual(result.points.map(point => point.quote));
        expect(result.model).toBe('qwen3.5:9b');
        expect(result.promptVersion).toBe(POLICY_REPORT_PROMPT_VERSION);
        expect(result.status).toBe('provisional');
    });

    it('asks for case ids and sentence numbers, not for quotes or a score', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(selection([{ caseId: 'deletion-right', sentence: 2, confidence: 0.9 }]))
            .mockResolvedValueOnce(verification([{ caseId: 'deletion-right', verdict: 'supported' }]));
        vi.stubGlobal('fetch', fetchMock);

        await ratePrivacyPolicyLocally({ url: 'https://example.com/privacy-policy', title: 'Privacy Policy', text, model: 'qwen3.5:9b' });

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body));
        expect(url).toBe('http://localhost:11434/api/chat');
        expect(body.format).toMatchObject({ type: 'object' });
        expect(body.options.num_ctx).toBeGreaterThanOrEqual(16_384);
        expect(body.messages[0].content).toContain('deletion-right');
        expect(JSON.stringify(init.body)).toContain('[2] You may request deletion');
        expect(JSON.stringify(init.body)).not.toContain('chrome-extension://');
    });

    it('keeps the highest-confidence sentence when a case is selected twice', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(selection([
                { caseId: 'deletion-right', sentence: 2, confidence: 0.4 },
                { caseId: 'deletion-right', sentence: 3, confidence: 0.9 },
            ]))
            .mockResolvedValueOnce(verification([{ caseId: 'deletion-right', verdict: 'supported' }]));
        vi.stubGlobal('fetch', fetchMock);

        const result = await ratePrivacyPolicyLocally({ url: 'https://example.com/privacy-policy', title: 'Privacy Policy', text, model: 'qwen3.5:9b' });

        expect(result.points).toHaveLength(1);
        expect(result.points[0].quote).toBe('We collect personal data to provide our services.');
    });

    it('drops a case the verification pass does not confirm', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(selection([
                { caseId: 'deletion-right', sentence: 2, confidence: 0.9 },
                { caseId: 'data-sold', sentence: 3, confidence: 0.9 },
            ]))
            .mockResolvedValueOnce(verification([
                { caseId: 'deletion-right', verdict: 'supported' },
                { caseId: 'data-sold', verdict: 'denied' },
            ]));
        vi.stubGlobal('fetch', fetchMock);

        const result = await ratePrivacyPolicyLocally({ url: 'https://example.com/privacy-policy', title: 'Privacy Policy', text, model: 'qwen3.5:9b' });

        expect(result.points.map(point => point.caseId)).toEqual(['deletion-right']);
        expect(result.score).toBe(58);
        expect(result.grade).toBe('C');
    });

    it('fails closed when nothing survives verification', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(selection([{ caseId: 'data-sold', sentence: 3, confidence: 0.9 }]))
            .mockResolvedValueOnce(verification([{ caseId: 'data-sold', verdict: 'denied' }]));
        vi.stubGlobal('fetch', fetchMock);

        await expect(ratePrivacyPolicyLocally({ url: 'https://example.com/privacy-policy', title: 'Privacy Policy', text, model: 'qwen3.5:9b' }))
            .rejects.toThrow('could not confirm any case');
    });

    it('rejects invented case ids and out-of-range sentence numbers', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(selection([
            { caseId: 'invented-case', sentence: 2, confidence: 0.9 },
            { caseId: 'deletion-right', sentence: 999, confidence: 0.9 },
        ])));

        await expect(ratePrivacyPolicyLocally({ url: 'https://example.com/privacy-policy', title: 'Privacy Policy', text, model: 'qwen3.5:9b' }))
            .rejects.toThrow('did not find a sentence that supports any case');
    });

    it('rejects malformed model output', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('not json at all')));
        await expect(ratePrivacyPolicyLocally({ url: 'https://example.com/privacy-policy', title: 'Privacy Policy', text, model: 'qwen3.5:9b' }))
            .rejects.toThrow('did not find a sentence that supports any case');
    });

    it('rejects an extension origin whose runtime URL does not match', async () => {
        vi.stubGlobal('window', { location: { origin: 'https://attacker.invalid', protocol: 'https:', hostname: 'attacker.invalid' } });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(ratePrivacyPolicyLocally({ url: 'https://example.com/privacy', title: 'Privacy', text, model: 'qwen3.5:9b' }))
            .rejects.toThrow('only from a TraceGuard extension view');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
