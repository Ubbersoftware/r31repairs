import { describe, it, expect } from 'vitest'
import { priceFor, fromPrice } from './pricing'

describe('pricing', () => {
  it('returns the exact battery price in thebe', () => {
    // iPhone 13 Pro battery = P900
    expect(priceFor('battery', 'iphone-13-pro')).toBe(90000)
  })
  it('distinguishes screen variants', () => {
    // iPhone 13 Pro screen: Basic P1400, OLED P2500
    expect(priceFor('screen', 'iphone-13-pro', 'Basic')).toBe(140000)
    expect(priceFor('screen', 'iphone-13-pro', 'OLED')).toBe(250000)
  })
  it('returns null for an unknown combination', () => {
    expect(priceFor('screen', 'nokia-3310', 'OLED')).toBeNull()
  })
  it('fromPrice returns the lowest available price for a service', () => {
    // cheapest battery in the seed is P500 (iPhone X) = 50000 thebe
    expect(fromPrice('battery')).toBe(50000)
  })
})
