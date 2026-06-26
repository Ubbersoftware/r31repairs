import type { Order, OrderEvent } from '@/lib/types/order'
type D = Record<string, any>

export function toOrder(id: string, d: D): Order {
  return {
    id, orderNumber: d.orderNumber, customerId: d.customerId,
    customerName: d.customerName ?? '', customerPhone: d.customerPhone ?? '',
    status: d.status,
    paymentStatus: d.paymentStatus ?? 'unpaid',
    invoiceId: d.invoiceId ?? null,
    devices: d.devices ?? [], items: d.items ?? [],
    estimatedTotal: d.estimatedTotal ?? 0, finalTotal: d.finalTotal,
    signatureURL: d.signatureURL, signedAt: d.signedAt, completedAt: d.completedAt,
    createdAt: d.createdAt ?? 0, updatedAt: d.updatedAt ?? 0,
  }
}

export function toOrderEvent(id: string, d: D): OrderEvent {
  return {
    id, type: d.type, fromStatus: d.fromStatus, toStatus: d.toStatus, note: d.note,
    visibility: d.visibility === 'customer' ? 'customer' : 'internal',
    byUserId: d.byUserId, byRole: d.byRole, at: d.at ?? 0,
  }
}
