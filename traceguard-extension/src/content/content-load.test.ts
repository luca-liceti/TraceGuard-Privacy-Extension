/**
 * Regression test: the content script must load and analyze pages without
 * throwing. A module-scope crash or a throw inside analyzePage would prevent
 * PAGE_ANALYSIS_RESULT from ever reaching the background, leaving the
 * sidebar/popup stuck on "no site recognized".
 */
import { describe, it, expect, vi } from 'vitest';

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
        const capture = captureClosedShadow();
        try {
            await showPIIConfirmCard({
                domain: 'example.com',
                fieldType: 'password',
                reason: 'risky',
                message: 'test',
                siteWSS: 40,
            });
            const host = document.getElementById('traceguard-pii-confirm-host');
            expect(host).not.toBeNull();
            expect(host?.shadowRoot).toBeNull();
            expect(capture.root()?.textContent).toContain('Is this website safe?');
            hidePIIConfirmCard();
            expect(document.getElementById('traceguard-pii-confirm-host')).toBeNull();
        } finally {
            capture.restore();
        }
    });

    it('pii-confirm card reports a confirm as safe so the penalty can be waived', async () => {
        const { showPIIConfirmCard, hidePIIConfirmCard } = await import('./pii-confirm');
        await showPIIConfirmCard({
            domain: 'example.com',
            fieldType: 'ssn',
            reason: 'risky',
            message: 'test',
            siteWSS: 40,
        });
        const capture = captureClosedShadow();
        try {
            await showPIIConfirmCard({
                domain: 'example.com',
                fieldType: 'ssn',
                reason: 'risky',
                message: 'test',
                siteWSS: 40,
            });
            const shadow = capture.root()!;
            const confirmBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent?.includes('Trust this site'))!;
            confirmBtn.click();
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'PII_CONFIRM_RESULT',
                domain: 'example.com',
                safe: true,
            });
            hidePIIConfirmCard();
        } finally {
            capture.restore();
        }
    });

    it('pii-confirm card reports a dismiss as not safe so the entry stays penalized', async () => {
        const { showPIIConfirmCard, hidePIIConfirmCard } = await import('./pii-confirm');
        await showPIIConfirmCard({
            domain: 'example.com',
            fieldType: 'password',
            reason: 'risky',
            message: 'test',
            siteWSS: 40,
        });
        const capture = captureClosedShadow();
        try {
            await showPIIConfirmCard({
                domain: 'example.com',
                fieldType: 'password',
                reason: 'risky',
                message: 'test',
                siteWSS: 40,
            });
            const shadow = capture.root()!;
            const dismissBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent?.includes('Keep warning me'))!;
            dismissBtn.click();
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'PII_CONFIRM_RESULT',
                domain: 'example.com',
                safe: false,
            });
            expect(document.getElementById('traceguard-pii-confirm-host')).toBeNull();
            hidePIIConfirmCard();
        } finally {
            capture.restore();
        }
    });
});
