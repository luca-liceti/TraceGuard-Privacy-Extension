import '@testing-library/jest-dom'

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
