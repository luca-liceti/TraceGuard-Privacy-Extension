/**
 * Regression test: the background service worker must load and register its
 * listeners without throwing. A module-scope crash here is invisible in the
 * browser, because a worker that never finishes loading simply never wakes, and
 * the symptom is "nothing happens" rather than an error.
 *
 * `vi.resetModules()` runs before each test so the import re-executes the
 * worker's module scope after the shared mock history is cleared.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type MessageListener = (
    message: unknown,
    sender: { id?: string },
    sendResponse: (response: unknown) => void,
) => boolean | undefined;

function registeredMessageListener(): MessageListener {
    const addListener = chrome.runtime.onMessage.addListener as unknown as { mock: { calls: unknown[][] } };
    return addListener.mock.calls[0][0] as MessageListener;
}

describe('background service worker loads', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('registers its listeners without a module-scope crash', async () => {
        await expect(import('./index')).resolves.toBeTruthy();

        expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
        expect(chrome.runtime.onStartup.addListener).toHaveBeenCalled();
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
        expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
        expect(chrome.tabs.onActivated.addListener).toHaveBeenCalled();
        expect(chrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalled();
    });

    it('rejects a malformed SETTINGS_CHANGED payload instead of throwing', async () => {
        await import('./index');
        const onMessage = registeredMessageListener();
        const sendResponse = vi.fn();

        const keepChannelOpen = onMessage({ type: 'SETTINGS_CHANGED' }, { id: chrome.runtime.id }, sendResponse);

        expect(keepChannelOpen).toBe(true);
        expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Invalid settings payload' });
    });

    it('ignores a message from an unknown sender', async () => {
        await import('./index');
        const onMessage = registeredMessageListener();
        const sendResponse = vi.fn();

        const result = onMessage({ type: 'SETTINGS_CHANGED' }, { id: 'some-other-extension' }, sendResponse);

        expect(result).toBeUndefined();
        expect(sendResponse).not.toHaveBeenCalled();
    });
});
