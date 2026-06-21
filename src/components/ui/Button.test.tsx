import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders a button with the primary class by default', () => {
    render(<Button>Book</Button>)
    const el = screen.getByRole('button', { name: 'Book' })
    expect(el.className).toMatch(/primary/)
  })
  it('renders an anchor when href is provided', () => {
    render(<Button href="/book">Book</Button>)
    expect(screen.getByRole('link', { name: 'Book' })).toHaveAttribute('href', '/book')
  })
})
