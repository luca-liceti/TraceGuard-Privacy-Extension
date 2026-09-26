/**
 * The User Privacy Score, derived from what the user handed over.
 *
 * UPS is not a running total that other code adds to and subtracts from. It is a
 * function of the record: read the handovers, weight them, decay them by age,
 * subtract the sum from 100. Nothing here writes anything, so the score can be
 * recomputed at any moment and cannot disagree with Your Footprint, because both
 * are views of the same data.
 *
 * Modelled on a credit score in the four ways that matter:
 *
 * - It rates decisions, not circumstance. Only a handover is scored. Visiting a
 *   site is not, because which sites appear in someone's browsing is mostly not
 *   their choice, and record 0010 already says rewarding or punishing visit
 *   outcomes teaches avoidance of risk signals instead of care.
 * - Old events age off, but never to nothing. See DECAY_FLOOR.
 * - It is derived from a record, so it is auditable rather than accumulated.
 * - Clearing an entry returns its full cost immediately, which is the one action
 *   the user can take, and the reason the sum is linear rather than curved.
 *
 * Record 0012 classifies this as context: true information with no claim on
 * behaviour. It does not change what the user does at the moment they decide;
 * the confirmation card is where that happens.
 */

import { getBasePenalty } from './pii';
import type { CrossSiteExposure } from './types';

/** Sensitivity bands, used to describe live exposures in plain language. */
export type SensitivityBand = 'critical' | 'high' | 'medium' | 'low';

/**
 * How long a handover takes to lose half its weight.
 *
 * Ninety days is a judgement, not a measurement. It is slow enough that a recent
 * card handover stays visibly expensive, and fast enough that a two-year-old
 * entry stops dominating a score it can no longer do anything about.
 */
export const DECAY_HALF_LIFE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * The least a handover can decay to, as a share of its original cost.
 *
 * Without a floor the model would claim an old handover is nearly harmless, and
 * we have no evidence a site deleted anything. The floor keeps the honest part
 * (that exposure is still there) while still letting recency dominate.
 */
export const DECAY_FLOOR = 0.25;

/** One handover: a field type the user typed into a particular site. */
export interface Handover {
    fieldType: string;
    domain: string;
    /** The site's safety score when the handover happened, when it is known. */
    wss: number | null;
    /**
     * When the user last handed this field type to this site, in epoch ms.
     * Null when the journal no longer holds a matching event, which happens
     * once 100 later handovers have pushed it out.
     */
    lastSeen: number | null;
    /** True when this was expected use (a login, a code, a trusted site). */
    exempt?: boolean;
}

/** The stored event shape the score needs, without depending on its full type. */
export interface HandoverEvent {
    fieldType: string;
    site: string;
    timestamp?: number;
    siteWSS?: number;
    exempt?: boolean;
}

export interface HandoverContribution {
    fieldType: string;
    domain: string;
    /** The cost before decay, from sensitivity and site risk. */
    baseWeight: number;
    /** What the handover costs right now, after decay. */
    weight: number;
    sensitivity: SensitivityBand;
    /** True when no event supplied a date, so the cost came from the floor. */
    undated: boolean;
}

export interface UpsBreakdown {
    /** The score, 0 to 100, rounded to one decimal. */
    score: number;
    /** The sum of every live contribution. Zero means nothing is priced. */
    total: number;
    /** The handovers that cost something, most expensive first. */
    contributions: HandoverContribution[];
    /** How many priced handovers had no recorded date. */
    undated: number;
}

/**
 * The sensitivity band for a field type, from the same penalty table the score
 * uses, so the count a user sees and the cost they pay cannot drift apart.
 */
export function sensitivityBand(fieldType: string): SensitivityBand {
    const base = getBasePenalty(fieldType);
    if (base >= 8) return 'critical';
    if (base >= 5) return 'high';
    if (base >= 3) return 'medium';
    return 'low';
}

/**
 * The cost of a handover before decay: sensitivity, multiplied by how risky the
 * site was when it happened.
 *
 * The multiplier runs from 1.0 on a flawless site to 2.0 on the worst one, which
 * matches the shape the old PII penalty used, so this change does not reprice
 * what a handover is worth on a given site, only when it counts and how it is
 * recovered.
 *
 * An unknown site score multiplies by 1.5 rather than by 1.0, because treating
 * an unknown site as a perfect one would silently discount the entry. The
 * multiplier is deliberately the same as a site scoring 50.
 */
export function handoverBaseWeight(fieldType: string, wss: number | null): number {
    const base = getBasePenalty(fieldType);
    if (base <= 0) return 0;
    const clampedWss = typeof wss === 'number' && Number.isFinite(wss)
        ? Math.max(0, Math.min(100, wss))
        : 50;
    return base * (1 + (100 - clampedWss) / 100);
}

/**
 * How much of a handover's cost remains after its age, from 1 down to the floor.
 *
 * An undated handover (no event left in the journal) is priced at the floor: it
 * is old by definition, since the journal keeps the 100 most recent, and the
 * floor is what the model says an old but live exposure costs.
 */
export function decayFactor(ageMs: number | null): number {
    if (ageMs === null || !Number.isFinite(ageMs)) return DECAY_FLOOR;
    if (ageMs <= 0) return 1;
    return Math.max(DECAY_FLOOR, Math.pow(0.5, ageMs / DECAY_HALF_LIFE_MS));
}

/**
 * Which of two handovers of the same field on the same site is the live one.
 *
 * The most recent wins, because giving a site your email again refreshes the
 * cost rather than adding a second one. An undated handover sorts as the oldest.
 */
function isMoreRecent(candidate: Handover, existing: Handover): boolean {
    const a = candidate.lastSeen ?? -Infinity;
    const b = existing.lastSeen ?? -Infinity;
    return a > b;
}

/**
 * The score, derived from the handovers that are still live.
 *
 * Exempt handovers (expected use) are recorded but cost nothing, which keeps a
 * routine login from chipping the score.
 */
export function scoreUps(handovers: Handover[], now: number): UpsBreakdown {
    const latest = new Map<string, Handover>();
    for (const handover of handovers) {
        const key = `${handover.fieldType}\u0000${handover.domain}`;
        const existing = latest.get(key);
        if (!existing || isMoreRecent(handover, existing)) {
            latest.set(key, handover);
        }
    }

    const contributions: HandoverContribution[] = [];
    let total = 0;
    let undated = 0;

    for (const handover of latest.values()) {
        if (handover.exempt) continue;

        const baseWeight = handoverBaseWeight(handover.fieldType, handover.wss);
        if (baseWeight <= 0) continue;

        const age = handover.lastSeen === null ? null : now - handover.lastSeen;
        const weight = baseWeight * decayFactor(age);
        if (weight <= 0) continue;

        total += weight;
        if (handover.lastSeen === null) undated += 1;

        contributions.push({
            fieldType: handover.fieldType,
            domain: handover.domain,
            baseWeight: Math.round(baseWeight * 100) / 100,
            weight: Math.round(weight * 100) / 100,
            sensitivity: sensitivityBand(handover.fieldType),
            undated: handover.lastSeen === null,
        });
    }

    contributions.sort((a, b) => b.weight - a.weight);

    return {
        score: Math.round(Math.max(0, 100 - total) * 10) / 10,
        total: Math.round(total * 100) / 100,
        contributions,
        undated,
    };
}

/** Live exposures counted by band, which is what clearing a record visibly changes. */
export function countByBand(breakdown: UpsBreakdown): Record<SensitivityBand, number> {
    const counts: Record<SensitivityBand, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const contribution of breakdown.contributions) counts[contribution.sensitivity] += 1;
    return counts;
}

/**
 * Turns stored state into the handovers the score prices.
 *
 * The exposure map is the set of pairs, because that is what survives; the
 * journal supplies the date, the site score at the time, and whether the entry
 * was expected use. A pair with no surviving event is still priced, at the decay
 * floor, so the record can never look newer or smaller than it is.
 */
export function buildHandovers(
    exposure: CrossSiteExposure | null | undefined,
    events: readonly HandoverEvent[] | null | undefined
): Handover[] {
    const latestEvent = new Map<string, HandoverEvent>();
    for (const event of events ?? []) {
        if (!event || typeof event.site !== 'string' || typeof event.fieldType !== 'string') continue;
        const key = `${event.fieldType}\u0000${event.site}`;
        const existing = latestEvent.get(key);
        const at = typeof event.timestamp === 'number' ? event.timestamp : -Infinity;
        const existingAt = existing && typeof existing.timestamp === 'number' ? existing.timestamp : -Infinity;
        if (!existing || at > existingAt) latestEvent.set(key, event);
    }

    const handovers: Handover[] = [];
    for (const [fieldType, domains] of Object.entries(exposure ?? {})) {
        if (!Array.isArray(domains)) continue;
        for (const domain of domains) {
            if (typeof domain !== 'string' || domain.length === 0) continue;
            const event = latestEvent.get(`${fieldType}\u0000${domain}`);
            handovers.push({
                fieldType,
                domain,
                wss: typeof event?.siteWSS === 'number' ? event.siteWSS : null,
                lastSeen: typeof event?.timestamp === 'number' ? event.timestamp : null,
                exempt: event?.exempt === true,
            });
        }
    }

    return handovers;
}
