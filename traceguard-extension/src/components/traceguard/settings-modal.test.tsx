/**
 * Regression tests for the Settings modal's less obvious state flows.
 *
 * The modal stays mounted for the life of the dashboard, so its local draft and
 * its cached diagnostics must be refreshed when it opens, not only when the
 * dashboard mounts. Discarding on close must also restore the draft, not just
 * hide the dialog.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import { SettingsProvider, useSettingsModal } from './settings-context'
import { SettingsModal } from './settings-modal'
import { recordError } from '@/lib/diagnostics'

const clearCachedPolicyReports = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('@/components/theme-provider', () => ({
    useTheme: () => ({ setTheme: vi.fn() }),
}))

vi.mock('@/lib/ai/policy-report-cache', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/ai/policy-report-cache')>()),
    clearCachedPolicyReports,
}))

function Harness() {
    const { setSettingsOpen, setActiveTab } = useSettingsModal()
    return (
        <>
            <button
                onClick={() => {
                    setActiveTab('privacy')
                    setSettingsOpen(true)
                }}
            >
                open settings
            </button>
            <button onClick={() => { setActiveTab('about'); setSettingsOpen(true) }}>open about</button>
            <SettingsModal />
        </>
    )
}

async function open(settings: Record<string, unknown> = {}) {
    await chrome.storage.local.set({ settings })
    render(
        <SettingsProvider>
            <Harness />
        </SettingsProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'open settings' }))
    return screen.findByRole('dialog')
}

async function storedSettings(): Promise<Record<string, unknown>> {
    const { settings } = await chrome.storage.local.get('settings')
    return settings as Record<string, unknown>
}

beforeEach(() => {
    clearCachedPolicyReports.mockClear()
})

describe('settings modal', () => {
    it('uses icons for section tabs only, with text actions on the Data and Privacy tabs', async () => {
        await open({ enableLocalSummaries: true })
        const dialog = await screen.findByRole('dialog')

        expect(within(dialog).getByRole('tab', { name: 'Appearance' }).querySelector('svg')).not.toBeNull()
        expect(within(dialog).getByRole('tab', { name: 'Privacy' }).querySelector('svg')).not.toBeNull()

        fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Data' }))
        expect(await within(dialog).findByRole('button', { name: 'Import' })).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Export to JSON' })).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Delete All Data' }).querySelector('svg')).toBeNull()

        fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Privacy' }))
        expect(await within(dialog).findByRole('button', { name: 'Refresh' })).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Refresh' }).querySelector('svg')).toBeNull()
    })

    it('keeps data action descriptions readable and their buttons at natural width', async () => {
        await open({})
        const dialog = await screen.findByRole('dialog')
        fireEvent.mouseDown(within(dialog).getByRole('tab', { name: /Data/i }))

        const clearCard = within(dialog).getByText('Clear Data').closest('div.rounded-lg')
        expect(clearCard).not.toBeNull()
        // Content-driven wrapping replaces the old fixed-width container query, so
        // the controls never stretch across the card to fill leftover space.
        expect(clearCard).toHaveClass('flex-wrap')
        expect(within(clearCard as HTMLElement).getByText('Clear activity logs or reset your privacy score and its history')).toBeInTheDocument()
        expect(within(clearCard as HTMLElement).getByRole('button', { name: 'Clear Activity Logs' })).not.toHaveClass('w-full')
    })

    it('keeps every settings section inside the dialog when it is resized narrow or short', async () => {
        await open({ enableLocalSummaries: true, enableLocalPolicyReports: true })
        const dialog = await screen.findByRole('dialog')
        const tabpanels = within(dialog).getAllByRole('tabpanel')

        expect(tabpanels.every(panel => panel.classList.contains('min-w-0'))).toBe(true)
        expect(dialog.querySelector('.overflow-y-auto')).toHaveClass('overflow-x-hidden')
        expect(dialog.querySelector('[role="tablist"]')?.closest('[role="tabpanel"]')).toBeNull()

        const settingsSections = [...dialog.querySelectorAll('[role="tabpanel"]')]
        expect(settingsSections.every(section => section.classList.contains('w-full'))).toBe(true)
        expect(settingsSections.every(section => section.classList.contains('min-w-0'))).toBe(true)

        fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Allowed and flagged' }))
        const domainEntryGrids = [...dialog.querySelectorAll('#add-whitelist, #add-blacklist')]
            .map(input => input.parentElement)
        expect(domainEntryGrids).toHaveLength(2)
        expect(domainEntryGrids.every(row => row?.classList.contains('grid-cols-[minmax(0,1fr)_auto]'))).toBe(true)

        fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'About' }))
        const diagnosticsToggleRow = dialog.querySelector('#dev-mode')?.parentElement
        expect(diagnosticsToggleRow).toHaveClass('flex-col')
        expect(diagnosticsToggleRow?.firstElementChild).toHaveClass('flex-1')
    })

    it('reverts discarded edits when the modal is closed and reopened', async () => {
        await open({ enablePIIDetection: true })
        const pii = await screen.findByRole('switch', { name: /Personal Information Detection/i })
        fireEvent.click(pii)
        expect(pii).toHaveAttribute('aria-checked', 'false')
        expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
        const confirm = await screen.findByRole('alertdialog')
        fireEvent.click(within(confirm).getByRole('button', { name: /Discard changes/i }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'open settings' }))
        const reopened = await screen.findByRole('dialog')
        expect(within(reopened).getByRole('switch', { name: /Personal Information Detection/i }))
            .toHaveAttribute('aria-checked', 'true')
        expect(within(reopened).queryByText(/unsaved changes/i)).not.toBeInTheDocument()
        expect((await storedSettings()).enablePIIDetection).toBe(true)
    })

    it('shows the model recommendation and picker when reports are enabled without summaries', async () => {
        await open({ enableLocalSummaries: false, enableLocalPolicyReports: true })
        const dialog = await screen.findByRole('dialog')

        expect(within(dialog).getByText('Ollama Model')).toBeInTheDocument()
        expect(await within(dialog).findByRole('region', { name: 'Recommended for this device' })).toBeInTheDocument()
    })

    it('keeps cached policy reports when saving settings while reports remain enabled', async () => {
        await open({ enableLocalPolicyReports: true, enablePIIDetection: true })
        fireEvent.click(await screen.findByRole('switch', { name: /Personal Information Detection/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

        await waitFor(async () => expect((await storedSettings()).enablePIIDetection).toBe(false))
        expect(clearCachedPolicyReports).not.toHaveBeenCalled()
    })

    it('clears cached policy reports when turning the feature off', async () => {
        await open({ enableLocalPolicyReports: true })
        fireEvent.click(screen.getByRole('switch', { name: /Local policy reports/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

        await waitFor(async () => expect((await storedSettings()).enableLocalPolicyReports).toBe(false))
        expect(clearCachedPolicyReports).toHaveBeenCalledTimes(1)
    })

    it('clears cached policy reports when resetting to defaults', async () => {
        await open({ enableLocalPolicyReports: true })
        fireEvent.mouseDown(screen.getByRole('tab', { name: /Data/i }))
        fireEvent.click(await screen.findByRole('button', { name: 'Reset to Defaults' }))

        const confirm = await screen.findByRole('alertdialog')
        fireEvent.click(within(confirm).getByRole('button', { name: /Continue/i }))

        await waitFor(async () => expect((await storedSettings()).enableLocalPolicyReports).toBe(false))
        expect(clearCachedPolicyReports).toHaveBeenCalledTimes(1)
    })

    it('describes delete-all as browser data deletion rather than account deletion', async () => {
        await open({})
        fireEvent.mouseDown(screen.getByRole('tab', { name: /Data/i }))
        fireEvent.click(await screen.findByRole('button', { name: 'Delete All Data' }))

        const confirmation = await screen.findByRole('alertdialog')
        expect(within(confirmation).getByText(/all TraceGuard data stored in this browser/i)).toBeInTheDocument()
        expect(within(confirmation).queryByText(/delete your account/i)).not.toBeInTheDocument()
    })

    it('shows errors recorded after the dashboard mounted', async () => {
        await open({})
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

        await recordError('late failure observed')

        fireEvent.click(screen.getByRole('button', { name: 'open settings' }))
        const reopened = await screen.findByRole('dialog')
        fireEvent.mouseDown(within(reopened).getByRole('tab', { name: 'About' }))
        expect(await within(reopened).findByText('late failure observed')).toBeInTheDocument()
        expect(within(reopened).getByRole('region', { name: 'Recent errors' })).toHaveTextContent('late failure observed')
        expect(within(reopened).getByText('1 error')).toBeInTheDocument()
    })
})
