/**
 * =============================================================================
 * TEST SETUP FILE - Mocking Chrome APIs for Unit Tests
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * Chrome extensions use special APIs (like chrome.storage, chrome.runtime)
 * that only exist in the browser. Since our tests run in Node.js, these APIs
 * don't exist! This file creates "mock" versions of those APIs so our tests
 * can run without the real Chrome browser.
 * 
 * WHAT IS MOCKING?
 * Mocking is creating fake versions of things for testing. For example,
 * instead of actually saving to Chrome storage, our mock just pretends to.
 * This lets us:
 * - Test our code without a real browser
 * - Control what the APIs return (for testing edge cases)
 * - Run tests much faster
 * 
 * MOCKED APIS:
 * - chrome.storage.local: get(), set(), remove(), clear(), getBytesInUse()
 * - chrome.storage.session: get(), set(), remove()
 * - chrome.storage.onChanged: addListener(), removeListener()
 * - chrome.runtime: sendMessage(), getURL(), getManifest()
 * - chrome.tabs: query(), sendMessage(), get()
 * - chrome.action: setPopup(), setBadgeText(), setBadgeBackgroundColor()
 * - chrome.sidePanel: setPanelBehavior()
 * - chrome.notifications: create(), onClicked
 * 
 * LIFECYCLE:
 * - beforeEach: Clears all mock call history AND the in-memory stores before
 *   each test, so tests are fully isolated.
 * 
 * HOW IT WORKS:
 * We create an object that looks like the chrome API, with a REAL in-memory
 * store backing chrome.storage.local.get/set/remove/clear. This means
 * storage.ts tests work correctly without having to patch individual mocks.
 * =============================================================================
 */
import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// In-memory backing stores — reset before each test for full isolation
// ---------------------------------------------------------------------------
let _localStore: Record<string, any> = {};
let _sessionStore: Record<string, any> = {};
const _onChangedListeners: ((...args: any[]) => void)[] = [];

function notifyChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
    for (const listener of _onChangedListeners) {
        try { listener(changes, area); } catch (_) { /* ignore */ }
    }
}

// Mock chrome API globally
const chromeMock = {
    storage: {
        local: {
            get: vi.fn(async (keys?: string | string[] | null) => {
                if (keys == null) return { ..._localStore };
                const keyArr = Array.isArray(keys) ? keys : [keys];
                const result: Record<string, any> = {};
                for (const k of keyArr) result[k] = _localStore[k];
                return result;
            }),
            set: vi.fn(async (items: Record<string, any>) => {
                const changes: Record<string, chrome.storage.StorageChange> = {};
                for (const [k, v] of Object.entries(items)) {
                    changes[k] = { oldValue: _localStore[k], newValue: v };
                    _localStore[k] = v;
                }
                notifyChanged(changes, 'local');
            }),
            remove: vi.fn(async (keys: string | string[]) => {
                const keyArr = Array.isArray(keys) ? keys : [keys];
                const changes: Record<string, chrome.storage.StorageChange> = {};
                for (const k of keyArr) {
                    changes[k] = { oldValue: _localStore[k], newValue: undefined };
                    delete _localStore[k];
                }
                notifyChanged(changes, 'local');
            }),
            clear: vi.fn(async () => {
                const changes: Record<string, chrome.storage.StorageChange> = {};
                for (const k of Object.keys(_localStore)) {
                    changes[k] = { oldValue: _localStore[k], newValue: undefined };
                }
                _localStore = {};
                notifyChanged(changes, 'local');
            }),
            getBytesInUse: vi.fn(async () => JSON.stringify(_localStore).length),
            QUOTA_BYTES: 5242880,
        },
        session: {
            get: vi.fn(async (keys?: string | string[] | null) => {
                if (keys == null) return { ..._sessionStore };
                const keyArr = Array.isArray(keys) ? keys : [keys];
                const result: Record<string, any> = {};
                for (const k of keyArr) result[k] = _sessionStore[k];
                return result;
            }),
            set: vi.fn(async (items: Record<string, any>) => {
                Object.assign(_sessionStore, items);
            }),
            remove: vi.fn(async (keys: string | string[]) => {
                const keyArr = Array.isArray(keys) ? keys : [keys];
                for (const k of keyArr) delete _sessionStore[k];
            }),
        },
        onChanged: {
            addListener: vi.fn((listener: (...args: any[]) => void) => {
                _onChangedListeners.push(listener);
            }),
            removeListener: vi.fn((listener: (...args: any[]) => void) => {
                const idx = _onChangedListeners.indexOf(listener);
                if (idx !== -1) _onChangedListeners.splice(idx, 1);
            }),
        },
    },
    runtime: {
        sendMessage: vi.fn().mockResolvedValue({}),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
        getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
        getManifest: vi.fn(() => ({ version: '1.0.0' })),
    },
    tabs: {
        query: vi.fn().mockResolvedValue([]),
        sendMessage: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue(null),
    },
    action: {
        setPopup: vi.fn().mockResolvedValue(undefined),
        setBadgeText: vi.fn().mockResolvedValue(undefined),
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
    },
    sidePanel: {
        setPanelBehavior: vi.fn().mockResolvedValue(undefined),
    },
    notifications: {
        create: vi.fn().mockResolvedValue(''),
        onClicked: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
    },
}

// @ts-expect-error - mocking chrome global
globalThis.chrome = chromeMock

// Reset mocks and backing stores between tests
beforeEach(() => {
    vi.clearAllMocks();
    _localStore = {};
    _sessionStore = {};
    _onChangedListeners.length = 0;
})
