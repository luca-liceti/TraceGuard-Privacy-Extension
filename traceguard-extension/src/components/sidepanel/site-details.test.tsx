import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import '@/lib/i18n'
import { SiteDetails } from './site-details'
import type { SiteRiskData } from '@/lib/types'

const mocks = vi.hoisted(() => ({
    settings: {
        enableLocalPolicyReports: false,
        localSummaryModel: 'qwen3.5:0.8b',
    },
}));

vi.mock('@/lib/useStorage', () => ({ useSettings: () => mocks.settings }))
vi.mock('@/lib/ai/policy-report', () => ({ ratePrivacyPolicyLocally: vi.fn() }))
vi.mock('@/lib/diagnostics', () => ({ logEvent: vi.fn() }))
vi.mock('@/lib/ai/hardware', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai/hardware')>('@/lib/ai/hardware')
    return {
        ...actual,
        detectHardware: vi.fn(async () => ({
            gpu: 'NVIDIA GeForce RTX 4070',
            kind: 'discrete',
            vramGb: 12,
            tier: 'better',
            model: 'gemma4:12b',
            sizeGb: '8.0 GB',
            note: 'Handles all three jobs.',
        })),
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
    mocks.settings.enableLocalPolicyReports = false
    // A capable model by default keeps the async hardware lookup out of tests
    // that are not about it. The warning test opts back into the small model.
    mocks.settings.localSummaryModel = 'qwen3.5:9b'
})

// The popup pins the document to one scroll region. A fixed-height ScrollArea
// nested inside the policy accordion traps the wheel there, so the rest of the
// list is unreachable; the popup must render the points inline instead.
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

test('does not warn when the selected model can do policy reports', () => {
    mocks.settings.enableLocalPolicyReports = true
    mocks.settings.localSummaryModel = 'qwen3.5:9b'

    renderWithPolicy('sidepanel', unratedSite)

    expect(screen.queryByText(/writes summaries but cannot hold a whole policy/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze policy with local model' })).toBeInTheDocument()
})
