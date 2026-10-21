import { describe, expect, it } from 'vitest';
import { POLICY_CASES, findCase, gradeFromScore, scoreFromCases } from './cases';

describe('POLICY_CASES', () => {
    it('has unique ids', () => {
        expect(new Set(POLICY_CASES.map(item => item.id)).size).toBe(POLICY_CASES.length);
    });

    it('looks cases up by id and rejects unknown ones', () => {
        expect(findCase('deletion-right')?.classification).toBe('good');
        expect(findCase('invented-case')).toBeUndefined();
    });

    it('names a topic for every case', () => {
        expect(POLICY_CASES.every(item => item.topic.length > 0)).toBe(true);
    });
});

describe('scoreFromCases', () => {
    it('stays neutral with no cases', () => {
        expect(scoreFromCases([])).toBe(50);
    });

    it('moves with the classification of each case', () => {
        expect(scoreFromCases([{ classification: 'good' }])).toBe(58);
        expect(scoreFromCases([{ classification: 'bad' }])).toBe(40);
        expect(scoreFromCases([{ classification: 'blocker' }])).toBe(30);
        expect(scoreFromCases([{ classification: 'neutral' }])).toBe(50);
    });

    it('clamps to the 0-100 range', () => {
        expect(scoreFromCases(Array.from({ length: 10 }, () => ({ classification: 'good' as const })))).toBe(100);
        expect(scoreFromCases(Array.from({ length: 10 }, () => ({ classification: 'blocker' as const })))).toBe(0);
    });

    it('is deterministic for the same cases', () => {
        const points = [{ classification: 'good' as const }, { classification: 'bad' as const }];
        expect(scoreFromCases(points)).toBe(scoreFromCases(points));
    });
});

describe('gradeFromScore', () => {
    it('uses the ToS;DR thresholds', () => {
        expect(gradeFromScore(90)).toBe('A');
        expect(gradeFromScore(89)).toBe('B');
        expect(gradeFromScore(70)).toBe('B');
        expect(gradeFromScore(69)).toBe('C');
        expect(gradeFromScore(50)).toBe('C');
        expect(gradeFromScore(49)).toBe('D');
        expect(gradeFromScore(30)).toBe('D');
        expect(gradeFromScore(29)).toBe('E');
    });
});
