import { describe, it, expect } from 'vitest'
import { subtotal, discountAmount, computeTotals } from './totals'
import type { InvoiceLineItem } from '@/lib/types/invoice'

const items: InvoiceLineItem[] = [
  { lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 },
  { lineId: 'b', description: 'Seal', sourceItemId: null, amount: 8000 },
]

describe('totals', () => {
  it('sums line items', () => {
    expect(subtotal(items)).toBe(128000)
  })
  it('applies a fixed-amount discount, clamped to subtotal', () => {
    expect(discountAmount(128000, { type: 'amount', value: 10000 })).toBe(10000)
    expect(discountAmount(128000, { type: 'amount', value: 999999 })).toBe(128000)
  })
  it('applies a percent discount, rounded to thebe', () => {
    expect(discountAmount(128000, { type: 'percent', value: 10 })).toBe(12800)
    expect(discountAmount(12345, { type: 'percent', value: 10 })).toBe(1235) // rounds .5 up
  })
  it('returns 0 discount when null', () => {
    expect(discountAmount(128000, null)).toBe(0)
  })
  it('computes totals and never goes below zero', () => {
    expect(computeTotals(items, { type: 'percent', value: 10 })).toEqual({ subtotal: 128000, discountAmount: 12800, total: 115200 })
    expect(computeTotals(items, { type: 'amount', value: 999999 })).toEqual({ subtotal: 128000, discountAmount: 128000, total: 0 })
  })
})
