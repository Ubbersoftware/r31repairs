import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ServiceCard } from './ServiceCard'

describe('ServiceCard', () => {
  it('links to the service and shows the from-price', () => {
    render(<ServiceCard href="/services/battery" title="Battery" desc="New cell" priceFrom="From P500" />)
    const link = screen.getByRole('link', { name: /Battery/ })
    expect(link).toHaveAttribute('href', '/services/battery')
    expect(screen.getByText('From P500 →')).toBeInTheDocument()
  })
})
