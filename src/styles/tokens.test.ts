import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')

describe('design tokens', () => {
  it('defines the electric-blue accent', () => {
    expect(css).toContain('--accent:          #2962FF')
  })
  it('defines the dark canvas as the default', () => {
    expect(css).toMatch(/:root\s*{[^}]*--bg:\s*#131722/)
  })
  it('provides a light theme override', () => {
    expect(css).toContain('[data-theme="light"]')
  })
})
