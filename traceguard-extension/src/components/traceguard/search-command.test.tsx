import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import type { SiteRiskData } from '@/lib/types'
import { SettingsProvider } from './settings-context'

const mocks = vi.hoisted(() => ({
    sites: [] as Array<[string, SiteRiskData]>,
}))

vi.mock('@/lib/useStorage', () => ({
    useSiteCache: () => ({ sites: mocks.sites }),
}))

vi.mock('@/components/traceguard/auth-provider', () => ({
    useAuth: () => ({ lock: vi.fn() }),
}))

vi.mock('@/components/traceguard/site-details-panel', () => ({
    SiteDetailsPanel: () => null,
}))

vi.mock('./export-data-dialog', () => ({
    ExportDataDialog: () => null,
}))

vi.mock('@/lib/storage', () => ({
    storage: { clearActivityLogs: vi.fn(), resetScore: vi.fn() },
}))

import { SearchCommand } from './search-command'

beforeEach(() => {
    mocks.sites = Array.from({ length: 59 }, (_, index) => [
        index === 58 ? 'protonmail.com' : `site-${index}.com`,
        {
            wss: 80,
            lastAnalyzed: 59 - index,
            visitCount: index,
        } as unknown as SiteRiskData,
    ])
})

describe('SearchCommand', () => {
    it('shows the three most recent sites and the ten most-visited analyzed sites with rating-only badges', async () => {
        render(
            <MemoryRouter>
                <SettingsProvider>
                    <SearchCommand />
                </SettingsProvider>
            </MemoryRouter>,
        )

        fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

        expect(await screen.findByText('Most Recent Sites')).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /site-0\.com.*Excellent/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /protonmail\.com.*Excellent/i })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: /site-48\.com/i })).not.toBeInTheDocument()
        expect(screen.getByRole('option', { name: /site-0\.com.*Excellent/i }).textContent).not.toContain('80')
    })

    it('finds cached sites beyond the displayed top-ten list when searching', async () => {
        render(
            <MemoryRouter>
                <SettingsProvider>
                    <SearchCommand />
                </SettingsProvider>
            </MemoryRouter>,
        )

        fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
        fireEvent.change(await screen.findByPlaceholderText('Type a command or search...'), {
            target: { value: 'site-30.com' },
        })

        expect(await screen.findByRole('option', { name: /site-30\.com/i })).toBeInTheDocument()
        expect(screen.queryByText('No results found.')).not.toBeInTheDocument()
    })
})
