// src/lib/types/order.test.ts
import { describe, it, expect } from 'vitest'
import { statusMeta, ORDER_STATUSES } from './order'

describe('statusMeta', () => {
  it('covers every status with a label + token', () => {
    for (const s of ORDER_STATUSES) {
      expect(statusMeta[s].label.length).toBeGreaterThan(0)
      expect(statusMeta[s].token).toMatch(/^--/)
    }
  })
  it('marks the two holds', () => {
    expect(statusMeta.awaiting_approval.hold).toBe(true)
    expect(statusMeta.awaiting_parts.hold).toBe(true)
    expect(statusMeta.in_repair.hold).toBe(false)
  })
})

describe('order statuses', () => {
  it('includes completed with deep-green success token, ordered before cancelled', () => {
    expect(ORDER_STATUSES).toContain('completed')
    expect(ORDER_STATUSES.indexOf('completed')).toBeLessThan(ORDER_STATUSES.indexOf('cancelled'))
    expect(statusMeta.completed).toEqual({ label: 'Completed', token: '--success', hold: false })
  })
})
