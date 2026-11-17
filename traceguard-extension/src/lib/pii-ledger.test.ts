import { describe, expect, it } from 'vitest';
import { buildPIILedgerContext } from './pii';

describe('buildPIILedgerContext', () => {
    it('reports what this site and other sites already hold', () => {
        const context = buildPIILedgerContext(
            { email: ['alpha-site.com', 'beta-site.com'], password: ['alpha-site.com'] },
            'alpha-site.com',
            'email',
        );

        expect(context.siteHasField).toBe(true);
        expect(context.otherHolders).toBe(1);
        expect(context.otherFields).toEqual(['password']);
    });

    it('does not count the current site as an outside holder', () => {
        const context = buildPIILedgerContext(
            { email: ['beta-site.com', 'gamma-site.com'] },
            'alpha-site.com',
            'email',
        );

        expect(context.siteHasField).toBe(false);
        expect(context.otherHolders).toBe(2);
        expect(context.otherFields).toEqual([]);
    });

    it('treats field aliases as one exposure and compares hosts case-insensitively', () => {
        const context = buildPIILedgerContext(
            { 'credit card': ['alpha-site.com'], creditcard: ['Beta-Site.com'] },
            'beta-site.com',
            'credit card',
        );

        expect(context.siteHasField).toBe(true);
        expect(context.otherHolders).toBe(1);
        expect(context.otherFields).toEqual([]);
    });

    it('returns an empty context when the ledger knows nothing', () => {
        expect(buildPIILedgerContext({}, 'alpha-site.com', 'email')).toEqual({
            siteHasField: false,
            otherHolders: 0,
            otherFields: [],
        });
    });
});
