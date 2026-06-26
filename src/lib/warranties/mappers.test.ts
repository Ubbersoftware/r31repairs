import { describe, it, expect } from 'vitest'
import { orderToWarrantyDrafts, toWarranty, toClaim } from './mappers'
import type { Order } from '@/lib/types/order'

const order: Order = {
  id: 'o1',
  orderNumber: 'R31-0001',
  customerId: 'c1',
  customerName: 'Thabo',
  customerPhone: '71234567',
  status: 'completed',
  paymentStatus: 'paid',
  invoiceId: 'inv1',
  devices: [
    { deviceId: 'd1', phoneModelId: 'm1', modelName: 'iPhone 13', label: undefined, notes: undefined },
  ],
  items: [
    { itemId: 'i1', deviceId: 'd1', serviceId: 's1', serviceName: 'Screen Replacement', variant: 'OLED', quotedAmount: 120000, lineStatus: 'completed' },
    { itemId: 'i2', deviceId: 'd1', serviceId: 's2', serviceName: 'Battery', variant: null, quotedAmount: 35000, lineStatus: 'completed' },
  ],
  estimatedTotal: 155000,
  createdAt: 1000,
  updatedAt: 2000,
}

describe('orderToWarrantyDrafts', () => {
  it('produces one draft per item', () => {
    const drafts = orderToWarrantyDrafts(order, 3, 5000)
    expect(drafts).toHaveLength(2)
  })
  it('resolves phoneModelName from devices', () => {
    const drafts = orderToWarrantyDrafts(order, 3, 5000)
    expect(drafts[0].phoneModelName).toBe('iPhone 13')
    expect(drafts[1].phoneModelName).toBe('iPhone 13')
  })
  it('sets orderId, customerId, invoiceId correctly', () => {
    const drafts = orderToWarrantyDrafts(order, 3, 5000)
    expect(drafts[0]).toMatchObject({ orderId: 'o1', customerId: 'c1', invoiceId: 'inv1' })
  })
  it('sets startDate = now and endDate = addMonths(now, months)', () => {
    const now = new Date(2024, 0, 1).getTime()
    const drafts = orderToWarrantyDrafts(order, 3, now)
    const expected = new Date(2024, 3, 1).getTime()
    expect(drafts[0].startDate).toBe(now)
    expect(drafts[0].endDate).toBe(expected)
  })
  it('status is always active', () => {
    const drafts = orderToWarrantyDrafts(order, 3, 5000)
    expect(drafts[0].status).toBe('active')
  })
  it('falls back to empty string when item has no matching device', () => {
    const noDevice = { ...order, devices: [] }
    const drafts = orderToWarrantyDrafts(noDevice, 3, 5000)
    expect(drafts[0].phoneModelName).toBe('')
  })
})

describe('toWarranty', () => {
  it('maps all fields with safe defaults', () => {
    const w = toWarranty('w1', { orderId: 'o1', customerId: 'c1', invoiceId: null, itemId: 'i1', serviceName: 'Screen', phoneModelName: 'iPhone 13', startDate: 100, endDate: 200, status: 'active', createdAt: 50 })
    expect(w).toMatchObject({ id: 'w1', orderId: 'o1', status: 'active', invoiceId: null })
  })
  it('defaults missing fields to empty/null/zero', () => {
    const w = toWarranty('w1', {})
    expect(w.serviceName).toBe('')
    expect(w.invoiceId).toBeNull()
    expect(w.startDate).toBe(0)
  })
})

describe('toClaim', () => {
  it('maps all fields', () => {
    const c = toClaim('cl1', { warrantyId: 'w1', customerId: 'c1', description: 'broken', photoURLs: ['x'], status: 'received', adminNotes: null, createdAt: 1, updatedAt: 2 })
    expect(c).toMatchObject({ id: 'cl1', warrantyId: 'w1', status: 'received' })
  })
  it('defaults photoURLs to empty array', () => {
    const c = toClaim('cl1', {})
    expect(c.photoURLs).toEqual([])
  })
})
