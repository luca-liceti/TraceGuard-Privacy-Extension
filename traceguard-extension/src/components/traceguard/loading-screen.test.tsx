import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { LoadingScreen } from './loading-screen'

describe('LoadingScreen', () => {
  it('renders the shared accessible TraceGuard loading state', () => {
    const { container } = render(<LoadingScreen />)

    const status = screen.getByRole('status')
    expect(container.querySelector('.startup-loading')).toContainElement(status)
    expect(status).toHaveTextContent('Loading TraceGuard')
    // The wrapper CSS draws the animated circle, so the label adds neither a
    // second circle nor animated dots of its own.
    expect(status).not.toHaveTextContent('...')
    expect(status.querySelector('[class*="animate-spin"]')).toBeNull()
    expect(status.querySelectorAll('[class*="animate-bounce"]')).toHaveLength(0)
  })
})
