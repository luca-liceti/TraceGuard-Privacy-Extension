import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDiagnosticsForTests, getSessionEvents, setDevMode } from '../lib/diagnostics';
import { capturePolicyText, type PolicyCaptureDeps } from './policy-capture';

beforeEach(() => {
    __resetDiagnosticsForTests();
    setDevMode(true);
});

const policyText = `Privacy Policy. ${'We collect your personal data to operate the service. '.repeat(30)}`;

function makeDeps(reads: Record<string, any>): PolicyCaptureDeps & { closed: number[] } {
    const closed: number[] = [];
    return {
        closed,
        fetchPage: vi.fn(async () => ({ ok: false, reason: 'fetch-failed' })),
        openTab: vi.fn(async () => 1),
        readPage: vi.fn(async () => reads.current),
        closeTab: vi.fn(async (tabId: number) => {
            closed.push(tabId);
        }),
    } as PolicyCaptureDeps & { closed: number[] };
}

describe('capturePolicyText', () => {
    it('returns readable policy text from the first candidate', async () => {
        const deps = makeDeps({
            current: {
                ok: true,
                url: 'https://example.com/privacy',
                title: 'Privacy Policy',
                text: policyText,
            },
        });
        vi.mocked(deps.fetchPage).mockResolvedValue({
            ok: true,
            url: 'https://example.com/privacy',
            title: 'Privacy Policy',
            text: policyText,
        });

        const result = await capturePolicyText(['https://example.com/privacy'], deps);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.url).toBe('https://example.com/privacy');
            expect(result.text).toContain('We collect your personal data');
        }
        expect(deps.closed).toEqual([]);
        expect(deps.openTab).not.toHaveBeenCalled();
    });

    it('uses the next fetched candidate when the first is a soft 404', async () => {
        const deps = makeDeps({ current: {} });
        vi.mocked(deps.fetchPage)
            .mockResolvedValueOnce({ ok: false, reason: 'soft-404' })
            .mockResolvedValueOnce({
                ok: true,
                url: 'https://example.com/privacy-policy',
                title: 'Privacy Policy',
                text: policyText,
            });

        const result = await capturePolicyText(['https://example.com/privacy', 'https://example.com/privacy-policy'], deps);

        expect(result.ok).toBe(true);
        expect(deps.openTab).not.toHaveBeenCalled();
    });

    it('closes the tab when the read throws', async () => {
        const closed: number[] = [];
        const deps: PolicyCaptureDeps = {
            fetchPage: vi.fn(async () => ({ ok: false, reason: 'not-policy' })),
            openTab: vi.fn(async () => 7),
            readPage: vi.fn(async () => { throw new Error('tab crashed'); }),
            closeTab: vi.fn(async (tabId: number) => { closed.push(tabId); }),
        };

        await expect(capturePolicyText(['https://example.com/privacy'], deps)).resolves.toMatchObject({ ok: false, reason: 'unreadable' });
        expect(closed).toEqual([7]);
        expect(getSessionEvents().some(event => event.event === 'policy_rendered_fallback_failed')).toBe(true);
    });

    it('reports no candidates without opening a tab', async () => {
        const deps = makeDeps({ current: {} });

        const result = await capturePolicyText([], deps);

        expect(result).toEqual({ ok: false, reason: 'no-candidates', attempted: 0 });
        expect(deps.openTab).not.toHaveBeenCalled();
    });

    it('reports unreadable when every candidate fails validation', async () => {
        const deps = makeDeps({
            current: { ok: true, url: 'https://example.com/privacy', title: 'Privacy', text: 'Too short.' },
        });

        const result = await capturePolicyText(
            ['https://example.com/privacy', 'https://example.com/legal/privacy'],
            deps,
        );

        expect(result).toEqual({ ok: false, reason: 'unreadable', attempted: 2 });
        expect(deps.closed).toHaveLength(1);
    });

    it('uses the rendered fallback when fetched HTML cannot be read', async () => {
        const deps = makeDeps({
            current: {
                ok: true,
                url: 'https://example.com/privacy',
                title: 'Privacy Policy',
                text: policyText,
            },
        });

        const result = await capturePolicyText(['https://example.com/privacy'], deps);

        expect(result.ok).toBe(true);
        expect(deps.openTab).toHaveBeenCalledTimes(1);
        expect(deps.closed).toEqual([1]);
    });

    it('limits the rendered fallback to one tab after all fetch candidates fail', async () => {
        const deps = makeDeps({ current: { ok: false, reason: 'timeout' } });

        await capturePolicyText(
            ['https://example.com/a', 'https://example.com/b', 'https://example.com/c', 'https://example.com/d', 'https://example.com/e'],
            deps,
        );

        expect(deps.fetchPage).toHaveBeenCalledTimes(4);
        expect(deps.openTab).toHaveBeenCalledTimes(1);
        expect(deps.openTab).toHaveBeenCalledWith('https://example.com/a');
    });

    it('skips a candidate whose tab could not be opened', async () => {
        const closed: number[] = [];
        const deps: PolicyCaptureDeps = {
            fetchPage: vi.fn(async () => ({ ok: false, reason: 'not-policy' })),
            openTab: vi.fn().mockResolvedValue(2),
            readPage: vi.fn(async () => ({ ok: true, url: 'https://example.com/privacy', title: 'Privacy Policy', text: policyText })),
            closeTab: vi.fn(async (tabId: number) => { closed.push(tabId); }),
        };

        const result = await capturePolicyText(['https://example.com/a', 'https://example.com/privacy'], deps);

        expect(result.ok).toBe(true);
        expect(closed).toEqual([2]);
    });
});
