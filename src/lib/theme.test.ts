import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getInitialTheme, applyTheme, THEME_KEY } from './theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('theme', () => {
  it('defaults to dark when nothing stored and OS not light', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia
    expect(getInitialTheme()).toBe('dark')
  })
  it('uses stored preference over OS', () => {
    localStorage.setItem(THEME_KEY, 'light')
    expect(getInitialTheme()).toBe('light')
  })
  it('applyTheme(light) sets the attribute and persists', () => {
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })
  it('applyTheme(dark) removes the attribute', () => {
    applyTheme('light'); applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
  })
})
