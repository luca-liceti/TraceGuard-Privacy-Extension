import { describe, expect, it, vi } from 'vitest';
import { POLICY_REPORT_TTL_MS, readCachedPolicyReport, readCachedPolicyReports, saveCachedPolicyReport } from './policy-report-cache';
import type { PolicyReportResult } from './policy-report';

const report: PolicyReportResult = {
    status: 'provisional',
    score: 16,
    grade: 'E',
    summary: '',
    evidence: [],
    points: [],
    model: 'qwen3.5:4b',
    promptVersion: 'policy-report-v4',
    generatedAt: 1_700_000_000_000,
};

describe('policy report cache', () => {
    it('returns a report saved for the same site', async () => {
        await saveCachedPolicyReport('example.com', report);
        expect(await readCachedPolicyReport('example.com')).toEqual(report);
    });

    it('keeps sites apart', async () => {
        await saveCachedPolicyReport('example.com', report);
        expect(await readCachedPolicyReport('other.example')).toBeNull();
    });

    it('ignores a report older than the time to live', async () => {
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now);
        await saveCachedPolicyReport('example.com', report);
        vi.spyOn(Date, 'now').mockReturnValue(now + POLICY_REPORT_TTL_MS + 1);

        expect(await readCachedPolicyReport('example.com')).toBeNull();
        vi.restoreAllMocks();
    });

    it('replaces an earlier report for the same site', async () => {
        await saveCachedPolicyReport('example.com', report);
        const newer = { ...report, score: 58, grade: 'C' as const };
        await saveCachedPolicyReport('example.com', newer);

        expect((await readCachedPolicyReport('example.com'))?.score).toBe(58);
    });

    it('lists every fresh report by site, so a table can show all grades at once', async () => {
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now);
        await saveCachedPolicyReport('stale.example', report);
        vi.spyOn(Date, 'now').mockReturnValue(now + POLICY_REPORT_TTL_MS + 1);
        await saveCachedPolicyReport('fresh.example', { ...report, grade: 'B' as const });

        expect(await readCachedPolicyReports()).toEqual({ 'fresh.example': { ...report, grade: 'B' } });
        vi.restoreAllMocks();
    });

    it('returns null when storage is unavailable', async () => {
        vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('no storage'));
        expect(await readCachedPolicyReport('example.com')).toBeNull();
    });
});
