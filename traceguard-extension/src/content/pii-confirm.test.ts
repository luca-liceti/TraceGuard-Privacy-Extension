import { afterEach, describe, expect, it } from 'vitest';
import { hidePIIConfirmCard, showPIIConfirmCard } from './pii-confirm';

afterEach(() => {
    hidePIIConfirmCard();
});

describe('PII confirmation card', () => {
    it('shows the ledger context and makes keeping the warning primary', async () => {
        await showPIIConfirmCard({
            domain: 'alpha-site.com',
            fieldType: 'email',
            reason: 'risky',
            message: '',
            siteWSS: 45,
            ledgerNote: 'This site already has your email. It is held by 3 sites in total.',
        });

        const shadow = document.getElementById('traceguard-pii-confirm-host')?.shadowRoot;
        expect(shadow).toBeTruthy();
        expect(shadow?.querySelector('.tg-ledger')?.textContent)
            .toBe('This site already has your email. It is held by 3 sites in total.');

        const primary = shadow?.querySelector('.tg-btn-primary') as HTMLButtonElement | null;
        const secondary = shadow?.querySelector('.tg-btn-secondary') as HTMLButtonElement | null;
        expect(primary?.textContent).toBe('Keep warning me');
        expect(secondary?.textContent).toBe('Trust this site');
    });
});
