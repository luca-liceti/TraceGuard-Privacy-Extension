import { describe, expect, it } from 'vitest';
import { validateSummary } from './fact-guard';
import type { SummaryRequest } from './types';

const request: SummaryRequest = {
    subject: 'site',
    subjectName: 'example.com',
    facts: [
        { label: 'Site', value: 'example.com' },
        { label: 'Website Safety Score', value: '72 out of 100' },
        { label: 'Trackers found', value: '4' },
    ],
};

describe('validateSummary', () => {
    it('accepts a short summary containing only supplied numbers and the site', () => {
        expect(validateSummary('The site example.com has a score of 72 out of 100, with 4 trackers found.', request))
            .toEqual({ ok: true, text: 'The site example.com has a score of 72 out of 100, with 4 trackers found.' });
    });

    it('does not reject an otherwise supported summary for referring to the reader as the user', () => {
        expect(validateSummary('The user visited example.com and saw a score of 72.', request)).toEqual({
            ok: true,
            text: 'The user visited example.com and saw a score of 72.',
        });
    });

    it('rejects any invented number', () => {
        expect(validateSummary('The site has a score of 95.', request)).toEqual({
            ok: false,
            violations: [{ kind: 'number', token: '95' }],
        });
    });

    it('rejects an invented domain', () => {
        expect(validateSummary('The site is similar to example.net.', request)).toEqual({
            ok: false,
            violations: [{ kind: 'domain', token: 'example.net' }],
        });
    });

    it('rejects an invented named entity', () => {
        expect(validateSummary('The site is similar to Acme.', request)).toEqual({
            ok: false,
            violations: [{ kind: 'name', token: 'Acme' }],
        });
    });

    it('rejects log summaries that confuse total visits with distinct sites', () => {
        const logRequest: SummaryRequest = {
            subject: 'log',
            subjectName: 'your stored browsing summary',
            facts: [
                { label: 'Sites analyzed (distinct sites)', value: '6' },
                { label: 'Visits counted (sum of visit counters, not site count)', value: '20' },
                { label: 'Sites listed below (top by visits, not all analyzed sites)', value: '5' },
                { label: 'Rank 1 site by visits, with safety score', value: 'www.google.com: 15 visits, score 96 out of 100' },
                { label: 'Rank 5 site by visits, with safety score', value: 'github.com: 1 visits, score 79 out of 100' },
            ],
        };
        expect(validateSummary('You visited 20 sites from a total of 6 analyzed.', logRequest).ok).toBe(false);
    });

    it('rejects conclusions that the top-five sample cannot establish', () => {
        const logRequest: SummaryRequest = {
            subject: 'log',
            subjectName: 'your stored browsing summary',
            facts: [
                { label: 'Sites analyzed (distinct sites)', value: '6' },
                { label: 'Visits counted (sum of visit counters, not site count)', value: '20' },
                { label: 'Sites listed below (top by visits, not all analyzed sites)', value: '5' },
                { label: 'Rank 1 site by visits, with safety score', value: 'www.google.com: 15 visits, score 96 out of 100' },
                { label: 'Rank 5 site by visits, with safety score', value: 'github.com: 1 visits, score 79 out of 100' },
            ],
        };
        expect(validateSummary('Your least visited site is github.com.', logRequest).ok).toBe(false);
        expect(validateSummary('The safety score range across all sites is 79 to 96.', logRequest).ok).toBe(false);
    });

    it('rejects overview summaries that present score signals as personal wins or absence of logs as proof', () => {
        const logRequest: SummaryRequest = {
            subject: 'log',
            subjectName: 'your recorded browsing summary',
            facts: [
                { label: 'Distinct analyzed sites', value: '6' },
                { label: 'Site safety-score distribution', value: '2 critical, 4 fair' },
                { label: 'Recorded personal-info form entries (not proof of submission)', value: '3' },
                { label: 'Recorded entries on sites below 60/100 safety', value: '2' },
            ],
        };
        expect(validateSummary('You visited the best site and made a safe choice.', logRequest).ok).toBe(false);
        expect(validateSummary('You never entered personal information.', logRequest).ok).toBe(false);
        expect(validateSummary('You visited 6 sites.', logRequest).ok).toBe(false);
    });

    it('accepts a zero-entry disclaimer that mentions sites, but rejects a count presented as a site count', () => {
        const zeroRequest: SummaryRequest = {
            subject: 'log',
            subjectName: 'your recorded browsing summary',
            facts: [
                { label: 'Distinct analyzed sites', value: '12' },
                { label: 'Recorded personal-info form entries (not proof of submission)', value: '0' },
                { label: 'Recorded form-entry pattern (not proof of submission)', value: 'No recorded form entries.' },
            ],
        };
        expect(validateSummary('No personal-info form entries were recorded on any site.', zeroRequest).ok).toBe(true);
        expect(validateSummary('The user has no recorded form entries across the analyzed sites.', zeroRequest).ok).toBe(true);
        expect(validateSummary('The user has no recorded form entries across sites.', zeroRequest).ok).toBe(true);
        expect(validateSummary('No recorded form entries occurred on 12 sites.', zeroRequest).ok).toBe(true);

        const handoverRequest: SummaryRequest = {
            ...zeroRequest,
            facts: [
                { label: 'Distinct analyzed sites', value: '12' },
                { label: 'Recorded personal-info form entries (not proof of submission)', value: '3' },
            ],
        };
        expect(validateSummary('You recorded 3 sites with form entries.', handoverRequest).ok).toBe(false);
    });

    it('rejects blank or unbounded output', () => {
        expect(validateSummary('  ', request).ok).toBe(false);
        expect(validateSummary('a'.repeat(1_201), request).ok).toBe(false);
        // The model may spend its whole 320-token budget without failing the check.
        const longButInBudget = 'The site example.com has a score of 72 out of 100, with 4 trackers found. '.repeat(14).trim();
        expect(longButInBudget.length).toBeLessThanOrEqual(1_150);
        expect(validateSummary(longButInBudget, request).ok).toBe(true);
    });

    it('accepts a site name that only drops the www. prefix', () => {
        const wwwRequest: SummaryRequest = {
            subject: 'site',
            subjectName: 'www.bbc.co.uk',
            facts: [
                { label: 'Site', value: 'www.bbc.co.uk' },
                { label: 'Website Safety Score (higher is safer)', value: '43/100 (fair)' },
            ],
        };
        expect(validateSummary('The site bbc.co.uk has a score of 43/100, which is fair.', wwwRequest).ok).toBe(true);
        expect(validateSummary('The site co.uk has a score of 43/100, which is fair.', wwwRequest).ok).toBe(false);
    });

    it('accepts a site shortened to the digits inside its recorded domain', () => {
        const numericRequest: SummaryRequest = {
            subject: 'log',
            subjectName: 'your recorded browsing summary',
            facts: [
                { label: 'Distinct analyzed sites', value: '156' },
                { label: 'Lowest-scoring analyzed site 1 (sampled evidence, not a complete audit)', value: 'site101.example: 12/100 (critical); trackers 14' },
                { label: 'Lowest-scoring analyzed site 2 (sampled evidence, not a complete audit)', value: 'site61.example: 21/100 (poor); trackers 12' },
            ],
        };
        expect(validateSummary('Sites 101 and 61 are the two lowest scoring.', numericRequest).ok).toBe(true);
        // A number that no fact contains is still invented.
        expect(validateSummary('Sites 101, 61, and 999 are the lowest scoring.', numericRequest)).toEqual({
            ok: false,
            violations: [{ kind: 'number', token: '999' }],
        });
    });

    it('treats the first word of a formatted line as prose, not as a named entity', () => {
        expect(validateSummary('**Bottom line:** The site example.com has a score of 72 out of 100.', request).ok).toBe(true);
        expect(validateSummary('Key findings:\n- The site example.com has a score of 72 out of 100.', request).ok).toBe(true);
        expect(validateSummary('1. Privacy note: the site example.com has a score of 72 out of 100.', request).ok).toBe(true);
        // A capitalized mid-sentence word is still checked.
        expect(validateSummary('The site example.com has a score of 72 out of 100, unlike Acme.', request).ok).toBe(false);
    });

    it('does not read an unrelated good score as praise for entering personal info', () => {
        const logRequest: SummaryRequest = {
            subject: 'log',
            subjectName: 'your recorded browsing summary',
            facts: [
                { label: 'Distinct analyzed sites', value: '6' },
                { label: 'Recorded personal-info form entries (not proof of submission)', value: '3' },
                { label: 'Recorded entries on sites at least 80/100 safety', value: '1' },
                { label: 'Highest-scoring analyzed site 1 (score is not proof of privacy)', value: 'example.org: 90/100 (excellent)' },
            ],
        };
        const separate = 'Two sites achieve good scores, which shows weaker tracking signals. Recorded form entries mean typing began, not that data was submitted.';
        expect(validateSummary(separate, logRequest).ok).toBe(true);
        expect(validateSummary('It is good that you entered personal info on safer sites.', logRequest).ok).toBe(false);
    });
});
