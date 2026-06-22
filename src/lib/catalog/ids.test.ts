import { describe, it, expect } from 'vitest'
import { priceId, parsePriceId } from './ids'

describe('priceId', () => {
  it('builds a composite id, encoding null variant as "none"', () => {
    expect(priceId('battery', 'iphone-13', null)).toBe('battery__iphone-13__none')
    expect(priceId('screen', 'iphone-13', 'OLED')).toBe('screen__iphone-13__oled')
  })
  it('round-trips through parsePriceId', () => {
    expect(parsePriceId('screen__iphone-13__oled')).toEqual({
      serviceId: 'screen', modelId: 'iphone-13', variant: 'oled',
    })
    expect(parsePriceId('battery__iphone-13__none')).toEqual({
      serviceId: 'battery', modelId: 'iphone-13', variant: null,
    })
  })
})
