import { afterEach, describe, expect, it, vi } from 'vitest';
import { hidePIIConfirmCard, showPIIConfirmCard } from './pii-confirm';

function captureClosedShadow() {
    const original = Element.prototype.attachShadow;
    let captured: ShadowRoot | null = null;
    const spy = vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init: ShadowRootInit) {
        const root = original.call(this, init);
        captured = root;
        return root;
    });
    return { root: () => captured, restore: () => spy.mockRestore() };
}

afterEach(() => {
    hidePIIConfirmCard();
    vi.restoreAllMocks();
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

        const capture = captureClosedShadow();
        try {
            await showPIIConfirmCard({
                domain: 'alpha-site.com',
                fieldType: 'email',
                reason: 'risky',
                message: '',
                siteWSS: 45,
                ledgerNote: 'This site already has your email. It is held by 3 sites in total.',
            });

            const host = document.getElementById('traceguard-pii-confirm-host');
            expect(host?.shadowRoot).toBeNull();
            const shadow = capture.root();
            expect(shadow).not.toBeNull();
            expect(shadow?.querySelector('.tg-ledger')?.textContent)
                .toBe('This site already has your email. It is held by 3 sites in total.');

            const primary = shadow?.querySelector('.tg-btn-primary') as HTMLButtonElement | null;
            const secondary = shadow?.querySelector('.tg-btn-secondary') as HTMLButtonElement | null;
            expect(primary?.textContent).toBe('Keep warning me');
            expect(secondary?.textContent).toBe('Trust this site');
        } finally {
            capture.restore();
        }
    });
});
