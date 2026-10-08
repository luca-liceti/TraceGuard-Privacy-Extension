import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

// The component animates from 0 to the stored score, so the tests wait for the
// score to land before asserting on the ring.
const appState = vi.hoisted(() => ({ ups: 0 }))

vi.mock('@/lib/useStorage', () => ({
  useAppState: () => ({ ups: appState.ups }),
  useScoreHistory: () => [{ timestamp: Date.now(), ups: appState.ups }],
  useActivityLogs: () => [],
}))

import { RadialChartScore } from './radial-chart-score'

test('the filled arc fades around the ring and reaches the stored score', async () => {
  appState.ups = 50
  const { container } = render(<RadialChartScore />)

  await waitFor(() => expect(screen.getByText('50')).toBeInTheDocument())

  const ring = container.querySelector('[style*="conic-gradient"]')
  expect(ring).not.toBeNull()
  // Half the ring, painted around its circumference rather than across it.
  expect(ring?.getAttribute('style')).toContain('180deg')
  expect(ring?.getAttribute('style')).toContain('conic-gradient(from -90deg')
})

test('a partial ring leaves both ends as plain caps', async () => {
  appState.ups = 50
  const { container } = render(<RadialChartScore />)

  await waitFor(() => expect(screen.getByText('50')).toBeInTheDocument())

  expect(container.querySelector('[style*="var(--score-ring-start)"]')).not.toBeNull()
  // No overlap, so no gap and shadow on the end cap.
  expect(container.querySelector('[style*="--score-ring-cap-shadow"]')).toBeNull()
})

test('a full ring overlaps its start and gives the end a gap and shadow', async () => {
  appState.ups = 100
  const { container } = render(<RadialChartScore />)

  await waitFor(() =>
    expect(container.querySelector('[style*="--score-ring-cap-shadow"]')).not.toBeNull(),
  )

  const ring = container.querySelector('[style*="conic-gradient"]')
  expect(ring?.getAttribute('style')).toContain('360deg')
})
