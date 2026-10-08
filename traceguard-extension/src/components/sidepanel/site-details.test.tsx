import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SiteDetails } from './site-details'
import type { SiteRiskData } from '@/lib/types'

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

function renderWithPolicy(variant: 'popup' | 'sidepanel') {
    const utils = render(<SiteDetails currentSite={siteWithPolicy} variant={variant} />)
    fireEvent.click(screen.getByText('Privacy Policy'))
    return utils
}

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
