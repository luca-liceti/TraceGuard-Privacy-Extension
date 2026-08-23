/**
 * =============================================================================
 * USER PRIVACY SCORE CHART SERIES
 * =============================================================================
 *
 * Turns the raw `scoreHistory` (one entry per page visit / PII event, in
 * chronological order) into the series rendered by the User Privacy Score
 * chart:
 *
 * - Today (1d): the raw score trajectory from midnight to now, anchored at the
 *   score the user carried over from before midnight.
 * - Last 7 / 30 days: one point per day, using the LAST score recorded that
 *   day. The UPS is a current-state score (like a bank balance), so averaging
 *   a day would smooth away real penalties and recoveries; the day's closing
 *   value is what "how the score changed" means. Days without visits carry the
 *   most recent known score, and days before the first recorded entry are
 *   never fabricated (backfilling 100 would imply history the user never had).
 * =============================================================================
 */

export interface ScorePoint {
    /** ISO timestamp for intra-day points; YYYY-MM-DD for daily points. */
    date: string;
    score: number;
}

export type ScoreHistoryLike = { timestamp: number; ups: number };

/** Local YYYY-MM-DD for a timestamp (same conversion the dashboard uses). */
export function localDateKey(timestamp: number): string {
    const d = new Date(timestamp);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

/** Timestamp of local midnight today. */
export function startOfToday(now: number = Date.now()): number {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * The "Today" series: score carried over from before midnight, then every
 * recorded point today, ending at the current time. Empty history produces an
 * empty series.
 */
export function buildTodaySeries(history: ScoreHistoryLike[], now: number = Date.now()): ScorePoint[] {
    if (history.length === 0) return [];
    const start = startOfToday(now);
    const beforeToday = history.filter(h => h.timestamp < start);
    const anchorScore = beforeToday.length > 0 ? beforeToday[beforeToday.length - 1].ups : 100;

    const series: ScorePoint[] = [];
    if (beforeToday.length > 0) {
        series.push({ date: new Date(start).toISOString(), score: anchorScore });
    }
    for (const h of history) {
        if (h.timestamp >= start) {
            series.push({ date: new Date(h.timestamp).toISOString(), score: h.ups });
        }
    }
    series.push({
        date: new Date(now).toISOString(),
        score: series.length > 0 ? series[series.length - 1].score : anchorScore,
    });
    return series;
}

/**
 * One point per day using the last score recorded that day, oldest first.
 * History is appended chronologically, so the last entry for a day is its
 * closing score.
 */
export function buildDailySeries(history: ScoreHistoryLike[]): ScorePoint[] {
    const lastByDay = new Map<string, number>();
    for (const h of history) {
        lastByDay.set(localDateKey(h.timestamp), h.ups);
    }
    return Array.from(lastByDay.entries())
        .map(([date, score]) => ({ date, score }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The last `days` days as daily points (oldest first). Days with no recorded
 * score carry the most recent known score; days before the first recorded
 * entry are omitted so the chart never invents history.
 */
export function buildRangeSeries(daily: ScorePoint[], days: number, now: number = Date.now()): ScorePoint[] {
    // No daily data at all: nothing to chart (and nothing to backfill with).
    if (daily.length === 0) return [];

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const firstDataDate = daily[0].date;

    const result: ScorePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateString = localDateKey(d.getTime());

        // Never fabricate a score for dates before the first recorded entry.
        if (firstDataDate && dateString < firstDataDate) continue;

        const existing = daily.find(item => item.date === dateString);
        if (existing) {
            result.push(existing);
        } else {
            const before = daily.filter(item => item.date < dateString);
            result.push({ date: dateString, score: before.length > 0 ? before[before.length - 1].score : 100 });
        }
    }
    return result;
}
