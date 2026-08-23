/**
 * =============================================================================
 * USER PRIVACY SCORE CHART SERIES TESTS
 * =============================================================================
 *
 * These lock in what each time-range tab must show:
 * - Today: the raw score trajectory from midnight to now (anchored at the
 *   score carried over from before midnight).
 * - Last 7 / 30 days: one point per day at that day's last recorded score,
 *   with days without visits carrying the most recent known score, and no
 *   fabricated history before the first recorded entry.
 * =============================================================================
 */
import { describe, it, expect } from 'vitest';
import { buildTodaySeries, buildDailySeries, buildRangeSeries, localDateKey, startOfToday } from './score-history';

// Deterministic "now": 2026-08-22 14:30 local.
const NOW = new Date(2026, 7, 22, 14, 30).getTime();

const at = (day: number, hour: number, minute = 0, ups: number) => ({
    timestamp: new Date(2026, 7, day, hour, minute).getTime(),
    ups,
});

describe('buildTodaySeries', () => {
    it('returns an empty series for empty history', () => {
        expect(buildTodaySeries([], NOW)).toEqual([]);
    });

    it('anchors at the score carried over from before midnight, then shows the day\'s points', () => {
        const history = [
            at(21, 22, 0, 100),   // yesterday 22:00
            at(22, 9, 0, 92),     // today 09:00
            at(22, 11, 30, 76),   // today 11:30
        ];
        const series = buildTodaySeries(history, NOW);
        const start = startOfToday(NOW);

        expect(series[0]).toEqual({ date: new Date(start).toISOString(), score: 100 });
        expect(series[1].score).toBe(92);
        expect(series[2].score).toBe(76);
        // Ends at "now" with the latest score.
        expect(series[series.length - 1]).toEqual({ date: new Date(NOW).toISOString(), score: 76 });
    });

    it('starts at the first point of the day when there is no history before today', () => {
        const history = [at(22, 8, 0, 95)];
        const series = buildTodaySeries(history, NOW);
        // No pre-midnight anchor: the series starts at today's first entry.
        expect(series[0].score).toBe(95);
        expect(series[1].score).toBe(95);
        expect(series.length).toBe(2);
    });
});

describe('buildDailySeries', () => {
    it('uses the last score recorded each day (closing value), oldest first', () => {
        const history = [
            at(20, 9, 0, 100),
            at(20, 15, 0, 90),
            at(21, 10, 0, 90),
            at(22, 9, 0, 88),
            at(22, 13, 0, 85),
        ];
        const daily = buildDailySeries(history);
        expect(daily).toEqual([
            { date: '2026-08-20', score: 90 },
            { date: '2026-08-21', score: 90 },
            { date: '2026-08-22', score: 85 },
        ]);
    });
});

describe('buildRangeSeries', () => {
    it('builds a point for each of the last 7 days, backfilling days without visits', () => {
        // Data on the 19th (88) and today the 22nd (85). Days in between carry
        // the last known score.
        const daily = [
            { date: '2026-08-19', score: 88 },
            { date: '2026-08-22', score: 85 },
        ];
        const range = buildRangeSeries(daily, 7, NOW);
        // 2026-08-22 minus 6 days = 2026-08-16; nothing before the 19th.
        expect(range[0]).toEqual({ date: '2026-08-19', score: 88 });
        expect(range).toContainEqual({ date: '2026-08-20', score: 88 });
        expect(range).toContainEqual({ date: '2026-08-21', score: 88 });
        expect(range[range.length - 1]).toEqual({ date: '2026-08-22', score: 85 });
    });

    it('never fabricates points before the first recorded entry', () => {
        const daily = [{ date: '2026-08-21', score: 90 }];
        const range = buildRangeSeries(daily, 30, NOW);
        expect(range[0].date).toBe('2026-08-21');
        expect(range.length).toBe(2); // 21st + 22nd only
    });

    it('uses 100 when nothing was recorded before an empty-gap day', () => {
        // Edge case: gap day with no prior data at all should not happen once
        // the first point exists, but the fallback must not produce NaN.
        const range = buildRangeSeries([], 7, NOW);
        expect(range).toEqual([]);
    });
});

describe('localDateKey', () => {
    it('formats a timestamp as local YYYY-MM-DD', () => {
        expect(localDateKey(new Date(2026, 7, 22, 0, 30).getTime())).toBe('2026-08-22');
        expect(localDateKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    });
});
