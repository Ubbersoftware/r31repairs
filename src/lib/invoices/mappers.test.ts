import { describe, it, expect } from 'vitest'
import { orderItemsToLineItems, toInvoice } from './mappers'
import type { OrderItem } from '@/lib/types/order'

const orderItems: OrderItem[] = [
  { itemId: 'i1', deviceId: 'd1', serviceId: 's1', serviceName: 'Screen Replacement', variant: 'OLED', quotedAmount: 120000, lineStatus: 'placed' },
  { itemId: 'i2', deviceId: 'd1', serviceId: 's2', serviceName: 'Battery', variant: null, quotedAmount: 35000, finalAmount: 40000, lineStatus: 'placed' },
]

describe('orderItemsToLineItems', () => {
  it('snapshots each order item, preferring finalAmount and labelling the variant', () => {
    const lines = orderItemsToLineItems(orderItems)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ description: 'Screen Replacement (OLED)', sourceItemId: 'i1', amount: 120000 })
    expect(lines[1]).toMatchObject({ description: 'Battery', sourceItemId: 'i2', amount: 40000 })
    expect(lines[0].lineId).toBeTruthy()
  })
})

describe('toInvoice', () => {
  it('maps a firestore doc into an Invoice with safe defaults', () => {
    const inv = toInvoice('inv1', {
      invoiceNumber: 'INV-0001', orderId: 'o1', customerId: 'c1',
      customerName: 'Thabo', customerPhone: '7', lineItems: [], discount: null,
      subtotal: 0, discountAmount: 0, total: 0, currency: 'BWP', status: 'draft',
      createdAt: 1, updatedAt: 1, createdBy: 'o1',
    })
    expect(inv.id).toBe('inv1')
    expect(inv.status).toBe('draft')
    expect(inv.paymentMethod).toBeNull()
    expect(inv.proofOfPaymentURL).toBeNull()
  })
})
