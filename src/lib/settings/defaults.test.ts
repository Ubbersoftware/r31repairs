import { describe, it, expect } from 'vitest'
import { mergeSettings, DEFAULT_SETTINGS } from './defaults'

describe('DEFAULT_SETTINGS', () => {
  it('has warrantyMonths = 3', () => { expect(DEFAULT_SETTINGS.warrantyMonths).toBe(3) })
  it('has at least one paymentChannel', () => { expect(DEFAULT_SETTINGS.paymentChannels.length).toBeGreaterThan(0) })
})

describe('mergeSettings', () => {
  it('returns DEFAULT_SETTINGS when given null', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })
  it('overrides defaults with stored values', () => {
    const merged = mergeSettings({ name: 'My Shop', warrantyMonths: 6 })
    expect(merged.name).toBe('My Shop')
    expect(merged.warrantyMonths).toBe(6)
  })
  it('falls back to defaults for fields not in stored', () => {
    const merged = mergeSettings({ name: 'My Shop' })
    expect(merged.paymentChannels).toEqual(DEFAULT_SETTINGS.paymentChannels)
  })
})
