import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaymentBadge } from './PaymentBadge'

describe('PaymentBadge', () => {
  it('renders a human label per payment status', () => {
    render(<PaymentBadge status="payment_submitted" />)
    expect(screen.getByText(/awaiting verification/i)).toBeInTheDocument()
  })
})
