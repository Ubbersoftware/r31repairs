import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Faq } from './Faq'

describe('Faq', () => {
  it('renders each question and answer', () => {
    render(<Faq items={[{ q: 'How long?', a: 'Same day.' }]} />)
    expect(screen.getByText('How long?')).toBeInTheDocument()
    expect(screen.getByText('Same day.')).toBeInTheDocument()
  })
})
