import { render } from '@testing-library/react'
import App from './dashboard/App'
import { test } from 'vitest'

test('renders App', () => {
  render(<App />)
})
