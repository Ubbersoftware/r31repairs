import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill } from './StatusPill'

describe('StatusPill', () => {
  it('renders the human label for a status', () => {
    render(<StatusPill status="ready" />)
    expect(screen.getByText('Ready for Collection')).toBeInTheDocument()
  })
  it('marks hold statuses as paused for assistive tech', () => {
    render(<StatusPill status="awaiting_parts" />)
    expect(screen.getByText('Awaiting Parts').closest('[data-hold="true"]')).not.toBeNull()
  })
})
