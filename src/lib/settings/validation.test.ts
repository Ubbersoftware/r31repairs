import { describe, it, expect } from 'vitest'
import { settingsInputSchema } from './validation'

const valid = {
  name: '31 Repairs', address: '123 Main St', mapURL: '', phone: '71234567',
  instagram: '@31repairs', logoURL: null,
  paymentChannels: [{ id: 'bank_transfer', label: 'Bank', payToLabel: 'Account', details: 'FNB 123' }],
  warrantyMonths: 3,
}

describe('settingsInputSchema', () => {
  it('accepts valid input', () => {
    expect(settingsInputSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects empty name', () => {
    expect(settingsInputSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })
  it('rejects warrantyMonths = 0', () => {
    expect(settingsInputSchema.safeParse({ ...valid, warrantyMonths: 0 }).success).toBe(false)
  })
  it('rejects warrantyMonths > 24', () => {
    expect(settingsInputSchema.safeParse({ ...valid, warrantyMonths: 25 }).success).toBe(false)
  })
  it('rejects empty paymentChannels array', () => {
    expect(settingsInputSchema.safeParse({ ...valid, paymentChannels: [] }).success).toBe(false)
  })
  it('accepts logoURL as null', () => {
    expect(settingsInputSchema.safeParse({ ...valid, logoURL: null }).success).toBe(true)
  })
})
