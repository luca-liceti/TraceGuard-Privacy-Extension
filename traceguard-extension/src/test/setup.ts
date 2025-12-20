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
 * - chrome.runtime: sendMessage(), getURL(), getManifest()
 * - chrome.tabs: query(), sendMessage(), get()
 * - chrome.action: setPopup(), setBadgeText(), setBadgeBackgroundColor()
 * - chrome.sidePanel: setPanelBehavior()
 * 
 * LIFECYCLE:
 * - beforeEach: Clears all mock call history before each test
 * - This ensures tests don't affect each other
 * 
 * HOW IT WORKS:
 * We create an object that looks like the chrome API, then assign it to
 * globalThis.chrome so all code that uses chrome.* will find our mock.
 * =============================================================================
 */
import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Mock chrome API globally
const chromeMock = {
    storage: {
        local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
            getBytesInUse: vi.fn().mockResolvedValue(0),
            QUOTA_BYTES: 5242880,
        },
        onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
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
}

// @ts-expect-error - mocking chrome global
globalThis.chrome = chromeMock

// Reset mocks between tests
beforeEach(() => {
    vi.clearAllMocks()
})
