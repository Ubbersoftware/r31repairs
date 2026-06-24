import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { formatOrderNumber } from './orderNumber'

describe('formatOrderNumber', () => {
  it('zero-pads to 4 digits with the R31- prefix', () => {
    expect(formatOrderNumber(1)).toBe('R31-0001')
    expect(formatOrderNumber(42)).toBe('R31-0042')
    expect(formatOrderNumber(12345)).toBe('R31-12345')
  })
})
