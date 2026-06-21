import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pill } from './Pill'

describe('Pill', () => {
  it('applies the tone class', () => {
    render(<Pill tone="success">Fixed</Pill>)
    const el = screen.getByText('Fixed')
    expect(el.className).toMatch(/success/)
  })
})
