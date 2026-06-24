import { describe, it, expect } from 'vitest'
import { toOrder, toOrderEvent } from './mappers'

describe('order mappers', () => {
  it('toOrder fills arrays + defaults', () => {
    const o = toOrder('o1', { orderNumber: 'R31-0001', customerId: 'u1', customerName: 'T', customerPhone: '7', status: 'placed', estimatedTotal: 2100, createdAt: 1, updatedAt: 1 })
    expect(o).toMatchObject({ id: 'o1', status: 'placed', paymentStatus: 'unpaid' })
    expect(o.devices).toEqual([]); expect(o.items).toEqual([])
  })
  it('toOrderEvent defaults visibility to internal', () => {
    expect(toOrderEvent('e1', { type: 'note', note: 'x', byUserId: 'o1', byRole: 'owner', at: 1 }).visibility).toBe('internal')
  })
})
