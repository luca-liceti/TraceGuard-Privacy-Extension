import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import '@/lib/i18n'
import { SiteDetails } from './site-details'
import type { SiteRiskData } from '@/lib/types'

const mocks = vi.hoisted(() => ({
    settings: {
        enableLocalPolicyReports: false,
        localSummaryModel: 'qwen3.5:0.8b' as string | undefined,
    },
    detectHardware: vi.fn(async () => ({
        gpu: 'NVIDIA GeForce RTX 4070',
        kind: 'discrete',
        vramGb: 12,
        tier: 'better',
        model: 'gemma4:12b',
        sizeGb: '8.0 GB',
        note: 'Handles all three jobs.',
    })),
    listRunningOllamaModels: vi.fn(async () => ['qwen3.5:9b']),
}));

const cache = vi.hoisted(() => ({ report: null as any }));

vi.mock('@/lib/useStorage', () => ({ useSettings: () => mocks.settings }))
vi.mock('@/lib/ai/policy-report-cache', () => ({
    readCachedPolicyReport: vi.fn(async () => cache.report),
    saveCachedPolicyReport: vi.fn(async () => {}),
}))
vi.mock('@/lib/ai/policy-report', () => ({ ratePrivacyPolicyLocally: vi.fn() }))
vi.mock('@/lib/ai/ollama', () => ({ listRunningOllamaModels: mocks.listRunningOllamaModels }))
vi.mock('@/lib/diagnostics', () => ({ logEvent: vi.fn() }))
vi.mock('@/lib/ai/hardware', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai/hardware')>('@/lib/ai/hardware')
    return {
        ...actual,
        detectHardware: mocks.detectHardware,
    }
})

const siteWithPolicy = {
    domain: 'example.com',
    wss: 42,
    breakdown: { policy: 50 },
    detectionDetails: {
        policy: {
            source: 'tosdr',
            serviceId: 'example',
            grade: 'C',
            points: [
                { title: 'Shares data with third parties', classification: 'bad' },
                { title: 'You can delete your account', classification: 'good' },
            ],
        },
    },
} as unknown as SiteRiskData

const unratedSite = {
    ...siteWithPolicy,
    detectionDetails: {
        policy: {
            source: 'local',
            hasLocalPolicy: true,
            points: [],
            documents: [],
        },
    },
} as unknown as SiteRiskData

function renderWithPolicy(variant: 'popup' | 'sidepanel', site: SiteRiskData = siteWithPolicy) {
    const utils = render(<SiteDetails currentSite={site} variant={variant} />)
    fireEvent.click(screen.getByText('Privacy Policy'))
    return utils
}

beforeEach(() => {
    cache.report = null
    mocks.settings.enableLocalPolicyReports = false
    mocks.settings.localSummaryModel = 'qwen3.5:9b'
    mocks.detectHardware.mockClear()
    mocks.listRunningOllamaModels.mockReset().mockResolvedValue(['qwen3.5:9b'])
})

// The popup pins the document to one scroll region. A fixed-height ScrollArea
// nested inside the policy accordion traps the wheel there, so the rest of the
// list is unreachable; the popup must render the points inline instead.
test('clicking the site URL opens its activity log in the dashboard', () => {
    const dashboardUrl = 'chrome-extension://test-id/src/dashboard/index.html#/overview?viewSite=example.com'

    for (const variant of ['popup', 'sidepanel'] as const) {
        const view = render(<SiteDetails currentSite={siteWithPolicy} variant={variant} />)
        fireEvent.click(view.getByRole('button', { name: 'View activity log: example.com' }))

        expect(chrome.tabs.create).toHaveBeenLastCalledWith({ url: dashboardUrl })
        view.unmount()
    }
})

test('popup renders the policy points without a nested scroll area', () => {
    const { container } = renderWithPolicy('popup')

    expect(screen.getByText('Shares data with third parties')).toBeInTheDocument()
    expect(screen.getByText('You can delete your account')).toBeInTheDocument()
    expect(container.querySelector('[data-radix-scroll-area-viewport]')).toBeNull()
})

test('side panel keeps the compact, capped policy list', () => {
    const { container } = renderWithPolicy('sidepanel')

    expect(screen.getByText('Shares data with third parties')).toBeInTheDocument()
    expect(container.querySelector('[data-radix-scroll-area-viewport]')).not.toBeNull()
})

test('warns that the summaries-only model cannot hold a policy', async () => {
    mocks.settings.enableLocalPolicyReports = true
    mocks.settings.localSummaryModel = 'qwen3.5:0.8b'

    renderWithPolicy('sidepanel', unratedSite)

    // The recommendation is detected asynchronously, so await it before asserting the rest.
    expect(await screen.findByText(/This device can run gemma4:12b\./)).toBeInTheDocument()
    expect(screen.getByText(/writes summaries but cannot hold a whole policy/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open model settings' })).toBeInTheDocument()
})

test('does not open a policy page for a summaries-only model', async () => {
    mocks.settings.enableLocalPolicyReports = true
    mocks.settings.localSummaryModel = 'qwen3.5:0.8b'

    renderWithPolicy('sidepanel', unratedSite)

    await waitFor(() => expect(mocks.detectHardware).toHaveBeenCalled())
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
    expect(screen.getByText(/writes summaries but cannot hold a whole policy/)).toBeInTheDocument()
})

test('does not open a policy page when no model is selected', async () => {
    mocks.settings.enableLocalPolicyReports = true
    mocks.settings.localSummaryModel = undefined

    renderWithPolicy('sidepanel', unratedSite)

    await waitFor(() => expect(chrome.runtime.sendMessage).not.toHaveBeenCalled())
})

test('does not open a policy page when the selected capable model is not loaded', async () => {
    mocks.settings.enableLocalPolicyReports = true
    mocks.settings.localSummaryModel = 'qwen3.5:9b'
    mocks.listRunningOllamaModels.mockResolvedValue([])

    renderWithPolicy('sidepanel', unratedSite)

    expect(await screen.findByRole('alert')).toHaveTextContent('The selected local model is not loaded in Ollama.')
    expect(mocks.listRunningOllamaModels).toHaveBeenCalledTimes(1)
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
})

test('starts the local report without waiting for a click', async () => {
    mocks.settings.enableLocalPolicyReports = true
    mocks.settings.localSummaryModel = 'qwen3.5:9b'

    renderWithPolicy('sidepanel', unratedSite)

    expect(screen.queryByText(/writes summaries but cannot hold a whole policy/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Analyze policy/ })).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('The privacy policy could not be found or read.')
    expect(mocks.listRunningOllamaModels).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

test('does not show a ToS;DR report link when there is no actual rating', () => {
    renderWithPolicy('sidepanel', unratedSite)

    expect(screen.queryByText('View full report')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ToS;DR/ })).not.toBeInTheDocument()
})

test('keeps a real ToS;DR report link for a rated service', () => {
    renderWithPolicy('sidepanel', siteWithPolicy)

    expect(screen.getByText('View full report')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ToS;DR/ })).toBeInTheDocument()
})

test('does not show loading on a rated site while another site report is running', async () => {
    mocks.settings.enableLocalPolicyReports = true
    mocks.settings.localSummaryModel = 'qwen3.5:9b'
    let resolveCapture!: (value: unknown) => void
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(() => new Promise((resolve) => {
        resolveCapture = resolve
    }) as Promise<any>)
    const first = { ...unratedSite, domain: 'unrated.example' }
    const view = render(<SiteDetails currentSite={first} variant="sidepanel" />)
    fireEvent.click(screen.getByText('Privacy Policy'))
    expect(await screen.findByRole('status')).toBeInTheDocument()

    view.rerender(<SiteDetails currentSite={siteWithPolicy} variant="sidepanel" />)
    fireEvent.click(screen.getByText('Privacy Policy'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()

    resolveCapture({ ok: false, reason: 'unreadable' })
    await waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.mocked(chrome.runtime.sendMessage).mockReset().mockResolvedValue(undefined)
})

test('shows a site that was already analyzed without running the model again', async () => {
    mocks.settings.enableLocalPolicyReports = true
    mocks.settings.localSummaryModel = 'qwen3.5:9b'
    cache.report = {
        status: 'provisional',
        score: 16,
        grade: 'E',
        summary: '',
        evidence: [],
        points: [{
            caseId: 'data-sold',
            title: 'Your personal data is sold',
            topic: 'Data sharing',
            classification: 'blocker',
            quote: 'We may sell your personal information.',
        }],
        model: 'qwen3.5:4b',
        promptVersion: 'policy-report-v4',
        generatedAt: Date.now(),
    }

    renderWithPolicy('sidepanel', unratedSite)

    expect(await screen.findByText('Your personal data is sold')).toBeInTheDocument()
    expect(screen.getByText(/Generated on this device by qwen3\.5:4b/)).toBeInTheDocument()
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
})
