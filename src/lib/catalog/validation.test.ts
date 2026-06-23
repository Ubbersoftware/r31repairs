import { describe, it, expect } from 'vitest'
import { priceEditSchema, serviceInputSchema } from './validation'

describe('priceEditSchema', () => {
  it('accepts a valid edit', () => {
    expect(priceEditSchema.safeParse({ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 80000, available: true }).success).toBe(true)
  })
  it('rejects negative or non-integer thebe amounts', () => {
    expect(priceEditSchema.safeParse({ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: -1, available: true }).success).toBe(false)
    expect(priceEditSchema.safeParse({ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 1.5, available: true }).success).toBe(false)
  })
})

describe('serviceInputSchema', () => {
  it('rejects an empty description', () => {
    expect(serviceInputSchema.safeParse({ id: 'screen', description: '', active: true }).success).toBe(false)
  })
})
