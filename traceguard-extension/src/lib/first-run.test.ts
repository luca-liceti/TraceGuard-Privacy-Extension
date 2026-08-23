/**
 * First-run redirect tests.
 *
 * On a fresh install (no vault) both the popup and the side panel must open
 * the dashboard tab that hosts the account-creation page instead of forcing
 * setup into their small surfaces.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { redirectToDashboardIfFirstRun } from './first-run';

describe('redirectToDashboardIfFirstRun', () => {
    beforeEach(async () => {
        await chrome.storage.local.clear();
    });

    it('opens the dashboard tab and reports a redirect when no vault exists', async () => {
        const redirected = await redirectToDashboardIfFirstRun();
        expect(redirected).toBe(true);
        expect(chrome.tabs.create).toHaveBeenCalledWith({
            url: chrome.runtime.getURL('src/dashboard/index.html'),
        });
    });

    it('does not redirect once the vault exists', async () => {
        await chrome.storage.local.set({ cryptoSalt: [1, 2, 3], validator: 'encrypted-validator' });
        const redirected = await redirectToDashboardIfFirstRun();
        expect(redirected).toBe(false);
        expect(chrome.tabs.create).not.toHaveBeenCalled();
    });
});
