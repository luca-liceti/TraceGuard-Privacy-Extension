/**
 * Regression test: the content script must load and analyze pages without
 * throwing. A module-scope crash or a throw inside analyzePage would prevent
 * PAGE_ANALYSIS_RESULT from ever reaching the background, leaving the
 * sidebar/popup stuck on "no site recognized".
 */
import { describe, it, expect } from 'vitest';

describe('content script loads and analyzes', () => {
    it('imports the content script bundle without module-scope errors', async () => {
        await expect(import('./index')).resolves.toBeTruthy();
    });

    it('analyzePage resolves with scores and page context', async () => {
        const { analyzePage } = await import('./analyzer');
        const result = await analyzePage();
        expect(result.scores).toBeDefined();
        expect(typeof result.scores.input).toBe('number');
        expect(result.pageContext).toBeDefined();
        expect(typeof result.pageContext.isLoginPage).toBe('boolean');
        expect(typeof result.pageContext.isCheckoutPage).toBe('boolean');
        expect(result.sensitiveFields).toBeDefined();
    });

    it('pii-confirm module loads and renders a card without throwing', async () => {
        const { showPIIConfirmCard, hidePIIConfirmCard } = await import('./pii-confirm');
        await showPIIConfirmCard({
            domain: 'example.com',
            fieldType: 'password',
            reason: 'risky',
            message: 'test',
            siteWSS: 40,
        });
        const host = document.getElementById('traceguard-pii-confirm-host');
        expect(host).not.toBeNull();
        expect(host?.shadowRoot?.textContent).toContain('Is this website safe?');
        hidePIIConfirmCard();
        expect(document.getElementById('traceguard-pii-confirm-host')).toBeNull();
    });
});
