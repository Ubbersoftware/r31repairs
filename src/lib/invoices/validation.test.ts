import { describe, it, expect } from 'vitest'
import { updateInvoiceSchema, proofSchema } from './validation'

describe('updateInvoiceSchema', () => {
  it('accepts integer thebe amounts and an optional discount', () => {
    const ok = updateInvoiceSchema.safeParse({
      lineItems: [{ lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 }],
      discount: { type: 'percent', value: 10 },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects non-integer / negative amounts', () => {
    expect(updateInvoiceSchema.safeParse({ lineItems: [{ lineId: 'a', description: 'x', sourceItemId: null, amount: 1.5 }], discount: null }).success).toBe(false)
    expect(updateInvoiceSchema.safeParse({ lineItems: [{ lineId: 'a', description: 'x', sourceItemId: null, amount: -1 }], discount: null }).success).toBe(false)
  })
  it('rejects a percent discount above 100', () => {
    expect(updateInvoiceSchema.safeParse({ lineItems: [{ lineId: 'a', description: 'x', sourceItemId: null, amount: 1 }], discount: { type: 'percent', value: 101 } }).success).toBe(false)
  })
})

describe('proofSchema', () => {
  it('requires an electronic method and a URL', () => {
    expect(proofSchema.safeParse({ paymentMethod: 'orange_money', proofURL: 'https://x/y.png' }).success).toBe(true)
    expect(proofSchema.safeParse({ paymentMethod: 'cash', proofURL: 'https://x/y.png' }).success).toBe(false)
    expect(proofSchema.safeParse({ paymentMethod: 'orange_money', proofURL: '' }).success).toBe(false)
  })
})
