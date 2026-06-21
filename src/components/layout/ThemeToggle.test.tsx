import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('toggles to light then back to dark', async () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole('button', { name: /theme/i })
    await userEvent.click(btn)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    await userEvent.click(btn)
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
})
