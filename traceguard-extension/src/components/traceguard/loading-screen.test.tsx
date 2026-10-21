import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { LoadingScreen } from './loading-screen'

describe('LoadingScreen', () => {
  it('renders the shared accessible TraceGuard loading state', () => {
    render(<LoadingScreen />)

    const status = screen.getByRole('status')
    expect(status).toHaveClass('startup-loading')
    expect(status).toHaveTextContent('Loading TraceGuard...')
  })
})
