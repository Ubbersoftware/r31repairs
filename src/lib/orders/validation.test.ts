import { describe, it, expect } from 'vitest'
import { bookingSchema, statusChangeSchema } from './validation'

describe('bookingSchema', () => {
  const ok = { devices: [{ deviceId: 'd1', phoneModelId: 'iphone-13', items: [{ itemId: 'i1', serviceId: 'screen', variant: 'OLED' }] }] }
  it('accepts a valid booking', () => { expect(bookingSchema.safeParse(ok).success).toBe(true) })
  it('rejects a booking with no devices', () => { expect(bookingSchema.safeParse({ devices: [] }).success).toBe(false) })
  it('rejects a device with no items', () => {
    expect(bookingSchema.safeParse({ devices: [{ deviceId: 'd1', phoneModelId: 'iphone-13', items: [] }] }).success).toBe(false)
  })
})

describe('statusChangeSchema', () => {
  it('accepts a known status, rejects an unknown one', () => {
    expect(statusChangeSchema.safeParse({ toStatus: 'in_repair', note: 'x' }).success).toBe(true)
    expect(statusChangeSchema.safeParse({ toStatus: 'teleported' }).success).toBe(false)
  })
})
