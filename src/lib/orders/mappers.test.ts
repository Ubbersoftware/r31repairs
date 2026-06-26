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

describe('toOrder payment + invoice fields', () => {
  it('reads paymentStatus and invoiceId from the doc, defaulting safely', () => {
    const o = toOrder('o1', { orderNumber: 'R31-0001', customerId: 'c1', status: 'ready' })
    expect(o.paymentStatus).toBe('unpaid')
    expect(o.invoiceId).toBeNull()
    const p = toOrder('o2', { paymentStatus: 'paid', invoiceId: 'inv1', signatureURL: 's', signedAt: 5, completedAt: 6 })
    expect(p.paymentStatus).toBe('paid')
    expect(p.invoiceId).toBe('inv1')
    expect(p.completedAt).toBe(6)
  })
})
