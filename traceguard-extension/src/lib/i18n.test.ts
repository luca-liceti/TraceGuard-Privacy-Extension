/**
 * The extension pages ship `<html lang="en">`. Switching language must update
 * that tag, or a screen reader reads Spanish, French, or German text with an
 * English voice. This guards the wiring in lib/i18n.ts.
 */
import { describe, it, expect } from 'vitest';
import i18n from './i18n';

describe('document language', () => {
    it('sets <html lang> to the language in use', async () => {
        await i18n.changeLanguage('fr');
        expect(document.documentElement.lang).toBe('fr');
    });

    it('updates <html lang> when the language changes again', async () => {
        await i18n.changeLanguage('de');
        expect(document.documentElement.lang).toBe('de');
        await i18n.changeLanguage('en');
        expect(document.documentElement.lang).toBe('en');
    });
});
