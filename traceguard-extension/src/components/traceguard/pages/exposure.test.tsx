/**
 * =============================================================================
 * FOOTPRINT ALLOW CONTROL
 * =============================================================================
 *
 * The allow button on Your Footprint is the one control there that lowers
 * safety, so these tests pin the three things that keep it honest:
 *
 * 1. It writes the same allow list the settings screen edits, so the two cannot
 *    disagree about which sites are trusted.
 * 2. The row shows the state it is in, and a second click takes it back.
 * 3. Removing takes out the entry that actually vouched for the row. An entry
 *    covers its own subdomains, so `patreon.com` covers `www.patreon.com`, and
 *    dropping the bare host would leave the row still allowed.
 * =============================================================================
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Toaster } from '@/components/ui/toast'
import { SiteDetailsProvider } from '@/components/traceguard/site-details-context'
import ExposurePage from './exposure'

const DAY = 24 * 60 * 60 * 1000

function site(domain: string, overrides: Record<string, unknown> = {}) {
    return {
        domain,
        wss: 80,
        breakdown: { reputation: 80, tracking: 80, cookies: 80, input: 80, policy: 80 },
        lastAnalyzed: Date.now() - DAY,
        visitCount: 5,
        ...overrides,
    }
}

async function seed(options: {
    exposure: Record<string, string[]>
    siteCache?: Record<string, unknown>
    whitelist?: string[]
}) {
    await chrome.storage.local.set({
        crossSiteExposure: options.exposure,
        piiDetections: [],
        siteCache: options.siteCache ?? {},
        settings: { whitelist: options.whitelist ?? [] },
    })
}

function renderPage() {
    // The page reads the allow list through useSettings and reports the result
    // through a toast, so both providers have to be present as they are in the
    // dashboard.
    return render(
        <Toaster>
            <SiteDetailsProvider>
                <ExposurePage />
            </SiteDetailsProvider>
        </Toaster>
    )
}

async function storedWhitelist(): Promise<string[]> {
    const { settings } = await chrome.storage.local.get('settings')
    return (settings as { whitelist?: string[] } | undefined)?.whitelist ?? []
}

describe('allow control on Your Footprint', () => {
    it('allows a site from its row, and a second click takes it back', async () => {
        await seed({
            exposure: { email: ['once.com'] },
            siteCache: { 'once.com': site('once.com', { visitCount: 1 }) },
        })
        renderPage()

        const allow = await screen.findByRole('button', { name: 'Allow: once.com' })
        expect(allow).toHaveAttribute('aria-pressed', 'false')
        fireEvent.click(allow)

        await waitFor(async () => expect(await storedWhitelist()).toContain('once.com'))

        // The row follows the stored list, so the label flips without a reload.
        const allowed = await screen.findByRole('button', { name: 'Remove from allow list: once.com' })
        expect(allowed).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(allowed)
        await waitFor(async () => expect(await storedWhitelist()).not.toContain('once.com'))
        expect(await screen.findByRole('button', { name: 'Allow: once.com' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('does not expand the row it sits on', async () => {
        // The row is itself a button that expands to show what else the site
        // holds, so the allow control has to stop the click. Otherwise allowing a
        // site also opens it, which reads as the click having done two things.
        await seed({
            exposure: { email: ['once.com'], password: ['once.com'] },
            siteCache: { 'once.com': site('once.com', { visitCount: 1 }) },
        })
        renderPage()

        const [allow] = await screen.findAllByRole('button', { name: 'Allow: once.com' })
        fireEvent.click(allow)

        await waitFor(async () => expect(await storedWhitelist()).toContain('once.com'))
        expect(screen.queryByText(/This site also holds/)).toBeNull()
    })

    it('removes the entry that vouches for the row, not only the bare host', async () => {
        await seed({
            exposure: { email: ['www.patreon.com'] },
            siteCache: { 'www.patreon.com': site('www.patreon.com') },
            whitelist: ['patreon.com'],
        })
        renderPage()

        const allowed = await screen.findByRole('button', { name: 'Remove from allow list: www.patreon.com' })
        fireEvent.click(allowed)

        await waitFor(async () => expect(await storedWhitelist()).not.toContain('patreon.com'))
        // Nothing is left behind that would still exempt the row.
        expect(await storedWhitelist()).toEqual([])
    })
})
