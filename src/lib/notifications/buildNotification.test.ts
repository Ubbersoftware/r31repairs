// src/lib/notifications/buildNotification.test.ts
import { describe, it, expect } from 'vitest'
import { buildStatusNotification, buildPriceNotification } from './buildNotification'

describe('buildNotification', () => {
  it('builds a status_change notification from the order + new status', () => {
    const n = buildStatusNotification({ userId: 'u1', orderId: 'o1', orderNumber: 'R31-0042', toStatus: 'ready', now: 100 })
    expect(n).toEqual({
      userId: 'u1', type: 'status_change', title: 'R31-0042',
      body: 'Status: Ready for Collection', link: '/orders/o1', read: false, createdAt: 100,
    })
  })
  it('builds a price_update notification', () => {
    const n = buildPriceNotification({ userId: 'u1', orderId: 'o1', orderNumber: 'R31-0042', now: 200 })
    expect(n).toMatchObject({ type: 'price_update', body: 'Your quote was updated', link: '/orders/o1', read: false, createdAt: 200 })
  })
})
