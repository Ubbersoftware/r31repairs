import { describe, it, expect } from 'vitest'
import { PAYMENT_METHODS, isElectronic, PAYMENT_CHANNELS } from './paymentMethods'

describe('payment methods', () => {
  it('lists all five methods', () => {
    expect(PAYMENT_METHODS).toEqual(['cash', 'bank_transfer', 'orange_money', 'myzaka', 'pay2cell'])
  })
  it('treats only cash as non-electronic', () => {
    expect(isElectronic('cash')).toBe(false)
    expect(isElectronic('orange_money')).toBe(true)
    expect(isElectronic('bank_transfer')).toBe(true)
  })
  it('exposes a pay-to channel for every electronic method', () => {
    const ids = PAYMENT_CHANNELS.map((c) => c.id)
    expect(ids).toEqual(['bank_transfer', 'orange_money', 'myzaka', 'pay2cell'])
    for (const c of PAYMENT_CHANNELS) {
      expect(c.label).toBeTruthy()
      expect(c.details).toBeTruthy()
    }
  })
})
