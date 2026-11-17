import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./database-loader', () => ({
    isTrackerDomain: vi.fn().mockResolvedValue(false),
    lookupTrackerDomain: vi.fn().mockResolvedValue(null),
    getDisconnectEntity: vi.fn().mockResolvedValue(null),
}));

import { getAndClearNetworkData, initNetworkMonitor } from './network-monitor';

type Listener = (details: {
    tabId: number;
    type: string;
    url: string;
    timeStamp: number;
    error?: string;
}) => void;

function registeredListeners(): { before: Listener; error: Listener } {
    const beforeMock = chrome.webRequest.onBeforeRequest.addListener as unknown as {
        mock: { calls: unknown[][] };
    };
    const errorMock = chrome.webRequest.onErrorOccurred.addListener as unknown as {
        mock: { calls: unknown[][] };
    };
    return {
        before: beforeMock.mock.calls[0][0] as Listener,
        error: errorMock.mock.calls[0][0] as Listener,
    };
}

describe('network monitor request privacy', () => {
    beforeEach(() => {
        initNetworkMonitor();
    });

    it('keys stored requests opaquely and keeps paths out of the snapshot', async () => {
        const { before, error } = registeredListeners();

        before({ tabId: 1, type: 'main_frame', url: 'https://alpha-site.com/', timeStamp: 1 });
        before({
            tabId: 1,
            type: 'script',
            url: 'https://tracker-site.com/collect?email=secret@example.com#fragment',
            timeStamp: 2,
        });

        error({
            tabId: 1,
            type: 'script',
            url: 'https://tracker-site.com/collect?email=secret@example.com#fragment',
            timeStamp: 3,
            error: 'net::ERR_BLOCKED_BY_CLIENT',
        });

        const data = await getAndClearNetworkData(1);
        expect(data).not.toBeNull();

        const keys = Object.keys(data!.requests);
        expect(keys).toHaveLength(1);
        expect(keys[0]).toMatch(/^r\d+$/);
        expect(keys[0]).not.toContain('tracker');
        expect(JSON.stringify(data)).not.toContain('collect');
        expect(JSON.stringify(data)).not.toContain('secret');

        const request = data!.requests[keys[0]];
        expect(request.url).toBe('https://tracker-site.com');
        expect(request.status).toBe('blockedByBrowser');
        expect(data).not.toHaveProperty('requestKeys');
        expect(data).not.toHaveProperty('nextRequestId');
    });

    it('reuses the opaque key for repeated requests to the same URL', async () => {
        const { before } = registeredListeners();
        const url = 'https://tracker-site.com/pixel?id=1';

        before({ tabId: 2, type: 'main_frame', url: 'https://alpha-site.com/', timeStamp: 1 });
        before({ tabId: 2, type: 'image', url, timeStamp: 2 });
        before({ tabId: 2, type: 'image', url, timeStamp: 3 });

        const data = await getAndClearNetworkData(2);
        expect(data).not.toBeNull();
        expect(Object.keys(data!.requests)).toHaveLength(1);
    });
});
