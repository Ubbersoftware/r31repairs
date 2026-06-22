import { describe, it, expect } from 'vitest'
import { priceFor, fromPrice } from './pricing'
import type { PriceDoc } from '@/lib/types/catalog'

const M: PriceDoc[] = [
  { serviceId: 'screen', modelId: 'iphone-13', variant: 'Basic', amount: 100000, available: true },
  { serviceId: 'screen', modelId: 'iphone-13', variant: 'OLED', amount: 200000, available: true },
  { serviceId: 'screen', modelId: 'iphone-12', variant: 'Basic', amount: 90000, available: false },
  { serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 80000, available: true },
]

describe('priceFor', () => {
  it('returns the amount for an available cell', () => {
    expect(priceFor(M, 'screen', 'iphone-13', 'OLED')).toBe(200000)
  })
  it('returns null for an unavailable cell', () => {
    expect(priceFor(M, 'screen', 'iphone-12', 'Basic')).toBeNull()
  })
})

describe('fromPrice', () => {
  it('returns the minimum available amount for a service', () => {
    expect(fromPrice(M, 'screen')).toBe(100000)
  })
})
