import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Nav } from './Nav'

describe('Nav', () => {
  it('shows the brand and a primary book CTA', () => {
    render(<Nav />)
    expect(screen.getByText(/31/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /book a repair/i })).toHaveAttribute('href', '/book')
  })
})
