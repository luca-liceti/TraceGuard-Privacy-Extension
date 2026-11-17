import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportKey, generateAesKey } from '../lib/crypto';
import { readSiteEntry } from '../lib/site-cache';

type MessageListener = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
) => boolean | undefined;

function registeredMessageListener(): MessageListener {
    const addListener = chrome.runtime.onMessage.addListener as unknown as { mock: { calls: unknown[][] } };
    return addListener.mock.calls[0][0] as MessageListener;
}

const SCORES = {
    reputation: 100,
    tracking: 100,
    cookies: 100,
    fingerprinting: 100,
    input: 100,
    policy: 100,
};

describe('background message router', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('runs page analysis through the listener and acknowledges it', async () => {
        await import('./index');

        const key = await generateAesKey();
        await chrome.storage.session.set({ cryptoKeyHex: await exportKey(key) });
        await chrome.storage.local.set({
            settings: {
                enabled: true,
                wssThreshold: 60,
                whitelist: [],
                blacklist: [],
                theme: 'system',
            },
            state: { ups: 100, sitesAnalyzed: 0, trackersDetected: 0, piiEventsCount: 0 },
        });

        const onMessage = registeredMessageListener();
        const response = await new Promise<unknown>((resolve) => {
            const keepChannelOpen = onMessage(
                {
                    type: 'PAGE_ANALYSIS_RESULT',
                    url: 'https://router-site.com/',
                    isInitialLoad: true,
                    scores: SCORES,
                    detectionDetails: {},
                },
                { id: chrome.runtime.id } as chrome.runtime.MessageSender,
                resolve,
            );
            expect(keepChannelOpen).toBe(true);
        });

        expect(response).toEqual({ success: true });
        expect(await readSiteEntry('router-site.com', key)).toMatchObject({
            domain: 'router-site.com',
            visitCount: 1,
        });
    });

    it('does not record PII while the extension is paused', async () => {
        await import('./index');
        await chrome.storage.local.set({
            settings: { enabled: false, wssThreshold: 60, whitelist: [], blacklist: [], theme: 'system' },
            state: { ups: 100, sitesAnalyzed: 0, trackersDetected: 0, piiEventsCount: 0 },
        });

        const onMessage = registeredMessageListener();
        const response = await new Promise<unknown>((resolve) => {
            const keepChannelOpen = onMessage(
                {
                    type: 'PII_DETECTED',
                    data: {
                        site: 'paused-site.com',
                        fieldType: 'password',
                        sensitivity: 'HIGH',
                        pageContext: { isLoginPage: true, isCheckoutPage: false },
                    },
                },
                { id: chrome.runtime.id, tab: { id: 7 } } as chrome.runtime.MessageSender,
                resolve,
            );
            expect(keepChannelOpen).toBe(true);
        });

        const stored = await chrome.storage.local.get(['piiDetections', 'notifications', 'state']) as {
            piiDetections?: unknown;
            notifications?: unknown;
            state: { piiEventsCount: number };
        };
        expect(response).toEqual({ success: true });
        expect(stored.piiDetections).toBeUndefined();
        expect(stored.notifications).toBeUndefined();
        expect(stored.state.piiEventsCount).toBe(0);
    });
});
