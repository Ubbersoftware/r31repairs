import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { formatInvoiceNumber } from './invoiceNumber'

describe('formatInvoiceNumber', () => {
  it('zero-pads to 4 digits with the INV- prefix', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-0001')
    expect(formatInvoiceNumber(42)).toBe('INV-0042')
    expect(formatInvoiceNumber(12345)).toBe('INV-12345')
  })
})
