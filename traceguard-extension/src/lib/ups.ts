/**
 * The User Privacy Score, derived from what the user handed over.
 *
 * UPS is not a running total that other code adds to and subtracts from. It is a
 * function of the record: read the handovers, weight them, decay them by age,
 * subtract the sum from 100. Nothing here writes anything, so the score can be
 * recomputed at any moment and can never disagree with Your Footprint, because
 * both are views of the same data.
 *
 * Modelled on a credit score in the four ways that matter:
 *
 * - It rates decisions, not circumstance. Only a handover is scored. Visiting a
 *   site is not, because which sites appear in someone's browsing is mostly not
 *   their choice, and record 0010 already says rewarding or punishing visit
 *   outcomes teaches avoidance of risk signals instead of care.
 * - Old events age off. A handover from two years ago is not the risk it was.
 * - It is derived from a record, so it is auditable rather than accumulated.
 * - Clearing an entry returns its full cost immediately, which is the one action
 *   the user can take, and the reason the sum is linear rather than curved.
 *
 * Record 0012 classifies this as context: true information with no claim on
 * behaviour. It does not change what the user does at the moment they decide;
 * the confirmation card is where that happens.
 */

import { getBasePenalty } from './pii';

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

/** One handover: a field type the user typed into a particular site. */
export interface Handover {
    fieldType: string;
    domain: string;
    /** The site's safety score when the handover happened, when it is known. */
    wss: number | null;
    /** When the user last handed this field type to this site, in epoch ms. */
    lastSeen: number;
}

export interface HandoverContribution {
    fieldType: string;
    domain: string;
    /** The cost before decay, from sensitivity and site risk. */
    baseWeight: number;
    /** What the handover costs right now, after decay. */
    weight: number;
    sensitivity: SensitivityBand;
}

export interface UpsBreakdown {
    /** The score, 0 to 100, rounded to one decimal. */
    score: number;
    /** The sum of every live contribution. Zero means nothing is held. */
    total: number;
    /** The handovers, most expensive first. */
    contributions: HandoverContribution[];
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
 */
export function handoverBaseWeight(fieldType: string, wss: number | null): number {
    const base = getBasePenalty(fieldType);
    if (base <= 0) return 0;
    // An unknown WSS is treated as the middle of the range rather than as safe.
    const clampedWss = typeof wss === 'number' && Number.isFinite(wss)
        ? Math.max(0, Math.min(100, wss))
        : 50;
    return base * (1 + (100 - clampedWss) / 100);
}

/** How much of a handover's cost remains after its age, from 1 down to 0. */
export function decayFactor(ageMs: number): number {
    if (!Number.isFinite(ageMs) || ageMs <= 0) return 1;
    return Math.pow(0.5, ageMs / DECAY_HALF_LIFE_MS);
}

/**
 * The score, derived from the handovers that are still live.
 *
 * A pair that has been handed over more than once is one entry, aged from its
 * most recent handover, so giving a site your email again refreshes its cost
 * instead of adding a second one.
 */
export function scoreUps(handovers: Handover[], now: number): UpsBreakdown {
    // Collapse repeats to the most recent handover of each field type per site.
    const latest = new Map<string, Handover>();
    for (const handover of handovers) {
        const key = `${handover.fieldType}\u0000${handover.domain}`;
        const existing = latest.get(key);
        if (!existing || handover.lastSeen > existing.lastSeen) {
            latest.set(key, handover);
        }
    }

    const contributions: HandoverContribution[] = [];
    let total = 0;

    for (const handover of latest.values()) {
        const baseWeight = handoverBaseWeight(handover.fieldType, handover.wss);
        if (baseWeight <= 0) continue;

        const weight = baseWeight * decayFactor(now - handover.lastSeen);
        if (weight <= 0) continue;

        total += weight;
        contributions.push({
            fieldType: handover.fieldType,
            domain: handover.domain,
            baseWeight: Math.round(baseWeight * 100) / 100,
            weight: Math.round(weight * 100) / 100,
            sensitivity: sensitivityBand(handover.fieldType),
        });
    }

    contributions.sort((a, b) => b.weight - a.weight);

    return {
        score: Math.round(Math.max(0, 100 - total) * 10) / 10,
        total: Math.round(total * 100) / 100,
        contributions,
    };
}

/** Live exposures counted by band, which is what clearing a record visibly changes. */
export function countByBand(breakdown: UpsBreakdown): Record<SensitivityBand, number> {
    const counts: Record<SensitivityBand, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const contribution of breakdown.contributions) counts[contribution.sensitivity] += 1;
    return counts;
}
