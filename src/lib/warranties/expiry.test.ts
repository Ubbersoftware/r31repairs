import { describe, it, expect } from 'vitest'
import { addMonths, warrantyState, WARRANTY_MONTHS } from './expiry'

describe('WARRANTY_MONTHS', () => {
  it('equals 3', () => { expect(WARRANTY_MONTHS).toBe(3) })
})

describe('addMonths', () => {
  it('adds calendar months', () => {
    const jan1 = new Date(2024, 0, 1).getTime()
    const apr1 = new Date(2024, 3, 1).getTime()
    expect(addMonths(jan1, 3)).toBe(apr1)
  })
  it('clamps Jan 31 + 1 month to Feb 28 (non-leap)', () => {
    const jan31 = new Date(2023, 0, 31).getTime()
    const feb28 = new Date(2023, 1, 28).getTime()
    expect(addMonths(jan31, 1)).toBe(feb28)
  })
  it('clamps Jan 31 + 1 month to Feb 29 (leap)', () => {
    const jan31 = new Date(2024, 0, 31).getTime()
    const feb29 = new Date(2024, 1, 29).getTime()
    expect(addMonths(jan31, 1)).toBe(feb29)
  })
  it('clamps Mar 31 + 1 month to Apr 30', () => {
    const mar31 = new Date(2024, 2, 31).getTime()
    const apr30 = new Date(2024, 3, 30).getTime()
    expect(addMonths(mar31, 1)).toBe(apr30)
  })
  it('handles year rollover (Dec + 1 = Jan next year)', () => {
    const dec1 = new Date(2023, 11, 1).getTime()
    const jan1 = new Date(2024, 0, 1).getTime()
    expect(addMonths(dec1, 1)).toBe(jan1)
  })
})

describe('warrantyState', () => {
  const w = (status: 'active' | 'claimed', endDate: number) => ({ status, endDate })
  it('returns claimed when status is claimed', () => {
    expect(warrantyState(w('claimed', Date.now() + 99999), Date.now())).toBe('claimed')
  })
  it('returns expired when now > endDate and status is active', () => {
    const past = Date.now() - 1000
    expect(warrantyState(w('active', past), Date.now())).toBe('expired')
  })
  it('returns active when now <= endDate and status is active', () => {
    const future = Date.now() + 1_000_000
    expect(warrantyState(w('active', future), Date.now())).toBe('active')
  })
  it('boundary: now === endDate is NOT expired (must be strictly greater)', () => {
    const t = 1_700_000_000_000
    expect(warrantyState(w('active', t), t)).toBe('active')
  })
})
