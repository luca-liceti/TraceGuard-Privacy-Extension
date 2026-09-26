import { describe, it, expect } from 'vitest';
import {
    scoreUps,
    handoverBaseWeight,
    decayFactor,
    sensitivityBand,
    countByBand,
    DECAY_HALF_LIFE_MS,
    type Handover,
} from './ups';

const NOW = 1_800_000_000_000;

const handover = (overrides: Partial<Handover> = {}): Handover => ({
    fieldType: 'creditCard',
    domain: 'example.com',
    wss: 100,
    lastSeen: NOW,
    ...overrides,
});

describe('handoverBaseWeight', () => {
    it('prices a card on a flawless site at its base sensitivity', () => {
        expect(handoverBaseWeight('creditCard', 100)).toBe(9);
    });

    it('doubles the cost on a site scoring zero', () => {
        expect(handoverBaseWeight('creditCard', 0)).toBe(18);
    });

    it('treats a missing site score as the middle of the range, not as safe', () => {
        expect(handoverBaseWeight('creditCard', null)).toBe(13.5);
    });

    it('resolves field type aliases through the shared penalty table', () => {
        expect(handoverBaseWeight('credit card', 100)).toBe(9);
        expect(handoverBaseWeight('cvv', 100)).toBe(9);
    });

    it('scales with sensitivity', () => {
        expect(handoverBaseWeight('email', 100)).toBe(4);
        expect(handoverBaseWeight('name', 100)).toBe(1);
    });
});

describe('decayFactor', () => {
    it('is unaffected at the moment of the handover', () => {
        expect(decayFactor(0)).toBe(1);
    });

    it('halves after one half life', () => {
        expect(decayFactor(DECAY_HALF_LIFE_MS)).toBeCloseTo(0.5, 10);
    });

    it('quarters after two', () => {
        expect(decayFactor(DECAY_HALF_LIFE_MS * 2)).toBeCloseTo(0.25, 10);
    });

    it('treats a future timestamp as no decay rather than as negative time', () => {
        expect(decayFactor(-5000)).toBe(1);
    });
});

describe('sensitivityBand', () => {
    it('bands field types by their penalty', () => {
        expect(sensitivityBand('ssn')).toBe('critical');
        expect(sensitivityBand('password')).toBe('critical');
        expect(sensitivityBand('phone')).toBe('high');
        expect(sensitivityBand('email')).toBe('medium');
        expect(sensitivityBand('securityCode')).toBe('medium');
        expect(sensitivityBand('username')).toBe('low');
        expect(sensitivityBand('name')).toBe('low');
    });
});

describe('scoreUps', () => {
    it('is a perfect score when nothing has been handed over', () => {
        const breakdown = scoreUps([], NOW);
        expect(breakdown.score).toBe(100);
        expect(breakdown.total).toBe(0);
        expect(breakdown.contributions).toEqual([]);
    });

    it('deducts the cost of a single handover', () => {
        expect(scoreUps([handover()], NOW).score).toBe(91);
    });

    it('deducts more on a riskier site', () => {
        expect(scoreUps([handover({ wss: 0 })], NOW).score).toBe(82);
    });

    it('has given back half the cost after one half life', () => {
        const breakdown = scoreUps([handover({ lastSeen: NOW - DECAY_HALF_LIFE_MS })], NOW);
        expect(breakdown.total).toBe(4.5);
        expect(breakdown.score).toBe(95.5);
    });

    it('never falls below zero however much was handed over', () => {
        const many = Array.from({ length: 20 }, (_, i) =>
            handover({ domain: `site${i}.com`, wss: 0 }));
        expect(scoreUps(many, NOW).score).toBe(0);
    });

    it('counts a repeated handover once, aged from the most recent', () => {
        const breakdown = scoreUps([
            handover({ lastSeen: NOW - DECAY_HALF_LIFE_MS * 40 }),
            handover({ lastSeen: NOW }),
        ], NOW);

        expect(breakdown.contributions).toHaveLength(1);
        expect(breakdown.score).toBe(91);
    });

    it('keeps two different field types on one site as separate costs', () => {
        const breakdown = scoreUps([
            handover({ fieldType: 'creditCard' }),
            handover({ fieldType: 'email' }),
        ], NOW);

        expect(breakdown.contributions).toHaveLength(2);
        expect(breakdown.score).toBe(87);
    });

    it('keeps the same field type on two sites as separate costs', () => {
        const breakdown = scoreUps([
            handover({ domain: 'a.com' }),
            handover({ domain: 'b.com' }),
        ], NOW);

        expect(breakdown.contributions).toHaveLength(2);
        expect(breakdown.score).toBe(82);
    });

    it('lists the most expensive handover first, so the worst is named', () => {
        const breakdown = scoreUps([
            handover({ fieldType: 'name', domain: 'a.com' }),
            handover({ fieldType: 'ssn', domain: 'b.com', wss: 0 }),
        ], NOW);

        expect(breakdown.contributions[0].fieldType).toBe('ssn');
        expect(breakdown.contributions[0].domain).toBe('b.com');
    });

    it('reports the weight both with and without decay, for attribution', () => {
        const breakdown = scoreUps([handover({ lastSeen: NOW - DECAY_HALF_LIFE_MS })], NOW);
        expect(breakdown.contributions[0].baseWeight).toBe(9);
        expect(breakdown.contributions[0].weight).toBe(4.5);
    });
});

describe('countByBand', () => {
    it('counts live exposures by sensitivity, which is what clearing changes', () => {
        const breakdown = scoreUps([
            handover({ fieldType: 'creditCard', domain: 'a.com' }),
            handover({ fieldType: 'email', domain: 'b.com' }),
            handover({ fieldType: 'name', domain: 'c.com' }),
        ], NOW);

        expect(countByBand(breakdown)).toEqual({ critical: 1, high: 0, medium: 1, low: 1 });
    });

    it('counts nothing when nothing is held', () => {
        expect(countByBand(scoreUps([], NOW))).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    });
});
