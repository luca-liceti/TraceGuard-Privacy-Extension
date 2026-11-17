import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toast'
import { SettingsProvider } from '@/components/traceguard/settings-context'
import { SettingsModal } from '@/components/traceguard/settings-modal'
import { useSettingsModal } from '@/components/traceguard/settings-context'
import '@/styles/globals.css'
import '@/lib/i18n'

const listeners = new Set<(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void>()
let localData: Record<string, any> = {
    settings: {
        enabled: true,
        theme: 'system',
        notificationLevel: 'balanced',
        logRetentionDays: 30,
        databaseRefreshDays: 7,
        wssThreshold: 60,
        enablePIIDetection: true,
        enableCloudTosdr: false,
        enableLocalSummaries: true,
        localSummaryModel: 'qwen3.5:0.8b',
        enableLocalPolicyReports: false,
        displayMode: 'sidebar',
        autoLockTimeout: -1,
        whitelist: ['example.com'],
        blacklist: [],
        devMode: false,
    },
    state: { ups: 82, sitesAnalyzed: 12, trackersDetected: 4, piiEventsCount: 3 },
    schemaVersion: 3,
}

function notify(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) {
    listeners.forEach((listener) => listener(changes, 'local'))
}

const storageArea = {
    get: async (keys?: string | string[] | null) => {
        if (keys == null) return { ...localData }
        const result: Record<string, unknown> = {}
        for (const key of Array.isArray(keys) ? keys : [keys]) result[key] = localData[key]
        return result
    },
    set: async (items: Record<string, unknown>) => {
        const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {}
        for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: localData[key], newValue: value }
            localData[key] = value
        }
        notify(changes)
    },
    remove: async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete localData[key]
    },
    clear: async () => { localData = {} },
    getBytesInUse: async () => JSON.stringify(localData).length,
    QUOTA_BYTES: 5_242_880,
}

const chromePreview = {
    storage: {
        local: storageArea,
        session: {
            get: async () => ({}),
            set: async () => undefined,
            remove: async () => undefined,
            clear: async () => undefined,
        },
        onChanged: {
            addListener: (listener: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void) => listeners.add(listener),
            removeListener: (listener: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void) => listeners.delete(listener),
        },
    },
    runtime: {
        getManifest: () => ({ version: '1.24.0' }),
        getURL: (path: string) => `chrome-extension://preview/${path}`,
        sendMessage: async () => ({}),
        onMessage: { addListener: () => undefined, removeListener: () => undefined },
    },
}

;(globalThis as any).chrome = chromePreview

function PreviewRoot() {
    const { setSettingsOpen, setActiveTab } = useSettingsModal()
    React.useEffect(() => {
        setActiveTab('privacy')
        setSettingsOpen(true)
    }, [setActiveTab, setSettingsOpen])
    return <><Toaster /><button className="fixed bottom-4 left-4 z-[100] rounded bg-primary px-3 py-2 text-primary-foreground" onClick={() => { setActiveTab('privacy'); setSettingsOpen(true) }}>Open Settings</button><SettingsModal /></>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <SettingsProvider><PreviewRoot /></SettingsProvider>
        </ThemeProvider>
    </React.StrictMode>,
)
