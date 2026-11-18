/**
 * =============================================================================
 * WEEKLY DIGEST
 * =============================================================================
 *
 * The digest used to be a toast that did nothing and left no record, then a
 * page of its own. These tests pin where it lives now:
 *
 * 1. The toast appears once with the week's numbers, in singular or plural.
 * 2. The same digest is written to the notification list, so it survives the
 *    toast and its bell entry can open the section again.
 * 3. The toast body, by pointer or keyboard, navigates to the top of Your
 *    Footprint, where the digest section renders the seven-day window.
 * =============================================================================
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toaster, toast } from '@/components/ui/toast'
import { SiteDetailsProvider } from '@/components/traceguard/site-details-context'
import { WeeklyDigestToast } from './weekly-digest-toast'
import ExposurePage from './pages/exposure'

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

const breakdown = { reputation: 80, tracking: 80, cookies: 80, fingerprinting: 80, input: 80, policy: 80 }

function trackedSite(domain: string, wss: number, organization: string | null) {
    return {
        domain,
        wss,
        breakdown,
        lastAnalyzed: now - DAY,
        enrichedDetails: {
            trackers: {
                items: [{ organization }],
                summary: { total: 1, active: 0, blockedByBrowser: 0, byCategory: {} },
            },
        },
    }
}

async function seedWeek() {
    await chrome.storage.local.set({
        piiDetections: [
            {
                timestamp: now - DAY,
                site: 'alpha-site.com',
                fieldType: 'password',
                sensitivity: 'HIGH',
                siteWSS: 45,
                scoreImpact: -10,
            },
            {
                timestamp: now - 2 * DAY,
                site: 'beta-site.com',
                fieldType: 'email',
                sensitivity: 'MEDIUM',
                siteWSS: 82,
                scoreImpact: -3,
            },
            // Outside the seven-day window, so it must not be counted.
            {
                timestamp: now - 9 * DAY,
                site: 'old-site.com',
                fieldType: 'ssn',
                sensitivity: 'HIGH',
                siteWSS: 20,
                scoreImpact: -20,
            },
        ],
        // The cache is read from its shards, not the legacy blob. The shard
        // number only picks a bucket, so one shard is enough for the fixture.
        'siteCache:v1:00': {
            'alpha-site.com': trackedSite('alpha-site.com', 45, 'Acme Trackers'),
            'beta-site.com': trackedSite('beta-site.com', 82, 'Beta Metrics'),
        },
    })
}

/** The dashboard's own arrangement: the toast renders inside the router. */
function renderToast() {
    return render(
        <Toaster>
            <MemoryRouter>
                <WeeklyDigestToast />
            </MemoryRouter>
        </Toaster>
    )
}

function renderRoutedToast() {
    return render(
        <Toaster>
            <HashRouter>
                <WeeklyDigestToast />
                <Routes>
                    <Route path="/overview" element={<div>overview page</div>} />
                    <Route path="/exposure" element={<div>footprint page</div>} />
                </Routes>
            </HashRouter>
        </Toaster>
    )
}

function renderFootprint() {
    return render(
        <MemoryRouter initialEntries={['/exposure']}>
            <SiteDetailsProvider>
                <ExposurePage />
            </SiteDetailsProvider>
        </MemoryRouter>
    )
}

describe('weekly digest', () => {
    afterEach(() => {
        // The toast manager is module-level, so it outlives a render.
        toast.close()
    })

    it('shows the week and records it in the notification list', async () => {
        await seedWeek()
        renderToast()

        await screen.findByText('Your weekly privacy digest')
        // Two events in the window, two sites, one of them below the default
        // threshold of 60, and two tracker companies. The nine-day-old event is
        // outside the window and absent from every count.
        expect(await screen.findByText(/2 personal-info entries on 2 sites/)).toBeInTheDocument()
        expect(screen.getByText(/1 site below 60/)).toBeInTheDocument()
        expect(screen.getByText(/2 tracker companies seen/)).toBeInTheDocument()

        await waitFor(async () => {
            const stored = await chrome.storage.local.get(['notifications', 'weeklyDigestAt'])
            const notifications = stored.notifications as Array<Record<string, unknown> & { message: string }>
            expect(typeof stored.weeklyDigestAt).toBe('number')
            expect(notifications).toHaveLength(1)
            expect(notifications[0]).toMatchObject({
                type: 'weekly_digest',
                title: 'Your weekly privacy digest',
                titleKey: 'Your weekly privacy digest',
                severity: 'info',
                read: false,
                actionUrl: '/exposure',
            })
            expect(notifications[0].message).toContain('personal-info')
        })
    })

    it('opens Your Footprint from the toast body, with no second control', async () => {
        await seedWeek()
        renderRoutedToast()

        const title = await screen.findByText('Your weekly privacy digest')
        // The toast is the whole control. A button would repeat it.
        expect(screen.queryByRole('button', { name: 'View digest' })).not.toBeInTheDocument()

        fireEvent.click(title)
        expect(await screen.findByText('footprint page')).toBeInTheDocument()
    })

    it('opens Your Footprint from the keyboard', async () => {
        // The toast root is focusable, so removing the button must not remove
        // the keyboard path to the same destination.
        await seedWeek()
        renderRoutedToast()

        await screen.findByText('Your weekly privacy digest')
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })

        expect(await screen.findByText('footprint page')).toBeInTheDocument()
    })

    it('still shows the digest when the notification cannot be written', async () => {
        // The digest must still appear if the write fails; the failure goes to
        // the error log and the summary is not silently dropped.
        await seedWeek()
        const setSpy = vi.spyOn(chrome.storage.local, 'set').mockRejectedValue(new Error('quota'))

        renderToast()

        expect(await screen.findByText('Your weekly privacy digest')).toBeInTheDocument()
        setSpy.mockRestore()
    })

    it('renders the seven-day window at the top of Your Footprint', async () => {
        await seedWeek()
        renderFootprint()

        const section = await screen.findByRole('region', { name: 'Weekly digest' })
        expect(within(section).getByText('Last 7 days')).toBeInTheDocument()

        // Personal info: field types, never values.
        expect(within(section).getByText('password')).toBeInTheDocument()
        expect(within(section).getByText('email')).toBeInTheDocument()

        // The low-scoring site is named and openable; the safe one is not listed.
        expect(within(section).getByRole('button', { name: 'View details: alpha-site.com' })).toBeInTheDocument()
        expect(within(section).queryByText('beta-site.com')).not.toBeInTheDocument()

        // Tracker companies come from the analyzed sites.
        expect(within(section).getByText('Acme Trackers')).toBeInTheDocument()
        expect(within(section).getByText('Beta Metrics')).toBeInTheDocument()
    })

    it('does not show a digest for a week with no activity', async () => {
        renderFootprint()

        expect(await screen.findByText('Nothing to show yet')).toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Weekly digest' })).not.toBeInTheDocument()
    })
})
