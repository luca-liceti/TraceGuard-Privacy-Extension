/**
 * =============================================================================
 * PII JOURNAL - The durable record of what was handed over
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 * The PII entry path keeps three rules, and they are the ones that broke before
 * this module existed:
 *
 *   1. A handover is recorded when it happens, not when its penalty is decided.
 *      The confirmation card decides whether an entry is penalized; it must
 *      never decide whether the entry exists.
 *   2. One site hands over one field type once. A second entry for the same pair
 *      is the same exposure, not a new one.
 *   3. An entry waiting on a verdict is provisional (`penaltyPending`). Settling
 *      it rewrites that entry; it does not append a second one, and it keeps the
 *      original timestamp so the ledger dates the handover to when it happened.
 *
 * The rules live here rather than inline in the worker so they can be tested
 * without booting the worker, whose module registers listeners on import and
 * cannot be loaded in isolation.
 * =============================================================================
 */

import { calculatePIIPenalty } from './pii';
import type { PIIDetectionEvent } from './types';

/** Matches the worker's cap on the journal, so staged writes agree with it. */
export const PII_JOURNAL_CAP = 100;

/** A journal entry, plus the provisional flag that only exists between the handover and its verdict. */
export type PIIJournalRecord = PIIDetectionEvent & {
    exempt?: boolean;
    exemptReason?: string;
    /** True while the entry waits on a confirmation card. Never present on a settled entry. */
    penaltyPending?: boolean;
};

/** The facts of a handover, known the moment the user types. */
export interface HandoverInput {
    timestamp: number;
    site: string;
    fieldType: string;
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
    siteWSS: number;
}

/** What the entry turned out to be, once the card has been answered or skipped. */
export interface Verdict {
    exempt: boolean;
    reason?: string;
    scoreImpact: number;
}

/** Is this entry still waiting on a decision? */
export function isPending(record: PIIJournalRecord | undefined | null): boolean {
    return record?.penaltyPending === true;
}

/** Index of the one entry for this site and field type, or -1. */
export function findRecordIndex(records: PIIJournalRecord[], site: string, fieldType: string): number {
    return records.findIndex(record => record.site === site && record.fieldType === fieldType);
}

/**
 * True when this handover is already in the journal: a settled entry is the same
 * exposure counted before, and a provisional one is the same exposure still
 * awaiting its verdict. Either way it must not be counted twice.
 */
export function isDuplicate(records: PIIJournalRecord[], site: string, fieldType: string): boolean {
    return findRecordIndex(records, site, fieldType) !== -1;
}

/** Keeps the newest `PII_JOURNAL_CAP` entries. */
export function trimToCap(records: PIIJournalRecord[]): PIIJournalRecord[] {
    return records.length > PII_JOURNAL_CAP ? records.slice(-PII_JOURNAL_CAP) : records;
}

/**
 * Stages the handover itself, before any penalty is known. Field TYPE, site and
 * timestamp only - the value that was typed is never read or stored.
 */
export function stageHandover(records: PIIJournalRecord[], handover: HandoverInput): PIIJournalRecord[] {
    return trimToCap([...records, {
        timestamp: handover.timestamp,
        site: handover.site,
        fieldType: handover.fieldType,
        sensitivity: handover.sensitivity,
        siteWSS: handover.siteWSS,
        scoreImpact: 0,        // Settled with the verdict, not before it
        exempt: false,         // Provisional until the card is answered
        penaltyPending: true,
    }]);
}

/**
 * Records the handover with its verdict.
 *
 * When the entry is already staged, the verdict is written onto it and the
 * original timestamp is kept; otherwise the handover is appended. Returns the
 * new journal for the caller to persist.
 */
export function applyVerdict(
    records: PIIJournalRecord[],
    handover: HandoverInput,
    verdict: Verdict,
): PIIJournalRecord[] {
    const index = findRecordIndex(records, handover.site, handover.fieldType);
    if (index === -1) {
        return trimToCap([...records, {
            timestamp: handover.timestamp,
            site: handover.site,
            fieldType: handover.fieldType,
            sensitivity: handover.sensitivity,
            siteWSS: handover.siteWSS,
            scoreImpact: verdict.scoreImpact,
            exempt: verdict.exempt,
            exemptReason: verdict.exempt ? verdict.reason : undefined,
        }]);
    }

    const settled: PIIJournalRecord = {
        timestamp: records[index].timestamp,
        site: records[index].site,
        fieldType: records[index].fieldType,
        sensitivity: records[index].sensitivity,
        siteWSS: records[index].siteWSS,
        scoreImpact: verdict.scoreImpact,
        exempt: verdict.exempt,
        exemptReason: verdict.exempt ? verdict.reason : undefined,
    };
    const next = [...records];
    next[index] = settled;
    return next;
}

/**
 * The entries abandoned when the worker was terminated with the card on screen:
 * provisional, and older than the timeout that would have settled them. A card
 * younger than the timeout may still be open on screen, so it is left alone.
 */
export function abandonedRecords(
    records: PIIJournalRecord[],
    now: number,
    timeoutMs: number,
): PIIJournalRecord[] {
    const cutoff = now - timeoutMs;
    return records.filter(record => isPending(record) && record.timestamp < cutoff);
}

export interface AbandonedSettlement {
    /** The journal with every abandoned entry settled and its penalty applied. */
    records: PIIJournalRecord[];
    /** How many entries were settled. Zero means nothing was abandoned. */
    count: number;
    /** The privacy score after the penalties. Unchanged when count is zero. */
    ups: number;
}

/**
 * Settles abandoned entries with the fail-safe an unanswered card carries:
 * penalize. Without this, a terminated worker would silently forgive every
 * penalty it had queued, and the entry would stay marked provisional forever.
 */
export function settleAbandonedRecords(
    records: PIIJournalRecord[],
    currentUPS: number,
    now: number,
    timeoutMs: number,
): AbandonedSettlement {
    const abandoned = abandonedRecords(records, now, timeoutMs);
    if (abandoned.length === 0) return { records, count: 0, ups: currentUPS };

    const abandonedSet = new Set(abandoned);
    let ups = currentUPS;
    const settled = records.map(record => {
        if (!abandonedSet.has(record)) return record;
        const { newUPS, penalty } = calculatePIIPenalty(ups, record.fieldType, record.siteWSS);
        ups = newUPS;
        return {
            timestamp: record.timestamp,
            site: record.site,
            fieldType: record.fieldType,
            sensitivity: record.sensitivity,
            siteWSS: record.siteWSS,
            scoreImpact: -penalty,
            exempt: false,
            exemptReason: 'unanswered',
        };
    });

    return { records: settled, count: abandoned.length, ups };
}
