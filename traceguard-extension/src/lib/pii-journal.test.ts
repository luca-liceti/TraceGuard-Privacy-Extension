import { describe, it, expect } from 'vitest';
import {
    PII_JOURNAL_CAP,
    abandonedRecords,
    applyVerdict,
    findRecordIndex,
    isDuplicate,
    isPending,
    settleAbandonedRecords,
    stageHandover,
    trimToCap,
    type PIIJournalRecord,
} from './pii-journal';

/**
 * These lock the invariant that broke: a handover is durable the moment it
 * happens, and the verdict that follows settles that entry rather than creating
 * a second one. The card decides the penalty, never whether the entry exists.
 */

const TIMEOUT = 120_000;

function handover(overrides: Partial<Parameters<typeof stageHandover>[1]> = {}) {
    return {
        timestamp: 1_000,
        site: 'app.notion.com',
        fieldType: 'password',
        sensitivity: 'HIGH' as const,
        siteWSS: 89,
        ...overrides,
    };
}

function settled(overrides: Partial<PIIJournalRecord> = {}): PIIJournalRecord {
    return {
        timestamp: 1_000,
        site: 'old-site.com',
        fieldType: 'email',
        sensitivity: 'MEDIUM',
        siteWSS: 70,
        scoreImpact: -5,
        exempt: false,
        ...overrides,
    };
}

describe('stageHandover', () => {
    it('records the handover with no verdict applied yet', () => {
        const [record] = stageHandover([], handover());

        expect(record).toMatchObject({
            site: 'app.notion.com',
            fieldType: 'password',
            sensitivity: 'HIGH',
            siteWSS: 89,
            scoreImpact: 0,
        });
        expect(isPending(record)).toBe(true);
    });

    it('never stores the typed value, because it is never passed in', () => {
        const [record] = stageHandover([], handover());
        expect(Object.values(record)).not.toContain(expect.stringContaining('secret'));
        expect(JSON.stringify(record)).not.toContain('password-value');
    });

    it('keeps at most the journal cap, dropping the oldest', () => {
        const full = Array.from({ length: PII_JOURNAL_CAP }, (_, i) =>
            settled({ site: `site-${i}.com`, timestamp: i })
        );

        const next = stageHandover(full, handover({ timestamp: 99_999 }));

        expect(next).toHaveLength(PII_JOURNAL_CAP);
        expect(next[0].site).toBe('site-1.com');
        expect(next[next.length - 1].site).toBe('app.notion.com');
    });
});

describe('applyVerdict', () => {
    it('settles the staged entry instead of appending a second one', () => {
        const staged = stageHandover([], handover());

        const settledRecords = applyVerdict(staged, handover(), {
            exempt: false,
            scoreImpact: -12,
        });

        expect(settledRecords).toHaveLength(1);
        expect(settledRecords[0].scoreImpact).toBe(-12);
        expect(isPending(settledRecords[0])).toBe(false);
    });

    it('keeps the timestamp of the handover, not of the verdict', () => {
        const staged = stageHandover([], handover({ timestamp: 1_000 }));

        const [record] = applyVerdict(staged, handover({ timestamp: 500_000 }), {
            exempt: false,
            scoreImpact: -12,
        });

        expect(record.timestamp).toBe(1_000);
    });

    it('records an exemption and its reason', () => {
        const [record] = applyVerdict([], handover(), {
            exempt: true,
            reason: 'login',
            scoreImpact: 0,
        });

        expect(record.exempt).toBe(true);
        expect(record.exemptReason).toBe('login');
        expect(record.scoreImpact).toBe(0);
    });

    it('clears the reason when the entry turned out to be penalized', () => {
        const staged = stageHandover([], handover());
        const [record] = applyVerdict(staged, handover(), {
            exempt: false,
            reason: 'risky',
            scoreImpact: -12,
        });

        expect(record.exemptReason).toBeUndefined();
    });

    it('appends when nothing was staged, which is the no-card path', () => {
        const existing = [settled({ site: 'other.com', fieldType: 'phone' })];

        const next = applyVerdict(existing, handover(), { exempt: false, scoreImpact: -12 });

        expect(next).toHaveLength(2);
        expect(next[1].site).toBe('app.notion.com');
    });

    it('does not mutate the array it was given', () => {
        const staged = stageHandover([], handover());
        const before = JSON.stringify(staged);

        applyVerdict(staged, handover(), { exempt: false, scoreImpact: -12 });

        expect(JSON.stringify(staged)).toBe(before);
    });
});

describe('isDuplicate / findRecordIndex', () => {
    it('treats a pending entry as already recorded, so it cannot be counted twice', () => {
        const staged = stageHandover([], handover());
        expect(isDuplicate(staged, 'app.notion.com', 'password')).toBe(true);
    });

    it('treats a settled entry as already recorded', () => {
        const records = [settled({ site: 'app.notion.com', fieldType: 'password' })];
        expect(isDuplicate(records, 'app.notion.com', 'password')).toBe(true);
    });

    it('separates the same site handing over a different field type', () => {
        const records = [settled({ site: 'app.notion.com', fieldType: 'email' })];
        expect(isDuplicate(records, 'app.notion.com', 'password')).toBe(false);
        expect(findRecordIndex(records, 'app.notion.com', 'password')).toBe(-1);
    });
});

describe('abandonedRecords', () => {
    it('returns a provisional entry older than the timeout', () => {
        const staged = stageHandover([], handover({ timestamp: 1_000 }));

        const abandoned = abandonedRecords(staged, 1_000 + TIMEOUT + 1, TIMEOUT);

        expect(abandoned).toHaveLength(1);
    });

    it('leaves a provisional entry that may still be on screen alone', () => {
        const staged = stageHandover([], handover({ timestamp: 1_000 }));

        expect(abandonedRecords(staged, 1_000 + TIMEOUT - 1, TIMEOUT)).toHaveLength(0);
    });

    it('never revisits a settled entry', () => {
        const records = [settled({ timestamp: 1 })];

        expect(abandonedRecords(records, 10 ** 9, TIMEOUT)).toHaveLength(0);
    });
});

describe('settleAbandonedRecords', () => {
    it('penalizes an abandoned entry rather than forgiving it', () => {
        const records = stageHandover([], handover({ timestamp: 1_000 }));

        const result = settleAbandonedRecords(records, 100, 1_000 + TIMEOUT + 1, TIMEOUT);

        expect(result.count).toBe(1);
        expect(result.ups).toBeLessThan(100);
        expect(isPending(result.records[0])).toBe(false);
        expect(result.records[0].exempt).toBe(false);
        expect(result.records[0].scoreImpact).toBeLessThan(0);
    });

    it('leaves an entry whose card may still be open untouched', () => {
        const records = stageHandover([], handover({ timestamp: 1_000 }));

        const result = settleAbandonedRecords(records, 100, 1_000 + TIMEOUT - 1, TIMEOUT);

        expect(result.count).toBe(0);
        expect(result.ups).toBe(100);
        expect(isPending(result.records[0])).toBe(true);
    });

    it('counts only the abandoned entries, not the settled ones', () => {
        const records = [
            settled({ site: 'settled.com', fieldType: 'email', timestamp: 1 }),
            ...stageHandover([], handover({ site: 'abandoned.com', timestamp: 1_000 })),
        ];

        const result = settleAbandonedRecords(records, 100, 1_000 + TIMEOUT + 1, TIMEOUT);

        expect(result.count).toBe(1);
        expect(result.records).toHaveLength(2);
        expect(result.records[0]).toEqual(records[0]);
    });
});

describe('trimToCap', () => {
    it('is a no-op below the cap and keeps the newest above it', () => {
        const short = [settled()];
        expect(trimToCap(short)).toBe(short);

        const long = Array.from({ length: PII_JOURNAL_CAP + 5 }, (_, i) =>
            settled({ site: `site-${i}.com`, timestamp: i })
        );
        const trimmed = trimToCap(long);
        expect(trimmed).toHaveLength(PII_JOURNAL_CAP);
        expect(trimmed[trimmed.length - 1].site).toBe(`site-${PII_JOURNAL_CAP + 4}.com`);
    });
});
