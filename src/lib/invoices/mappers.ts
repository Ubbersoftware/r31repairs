import type { OrderItem } from '@/lib/types/order'
import type { Invoice, InvoiceLineItem } from '@/lib/types/invoice'

type D = Record<string, any>

export function orderItemsToLineItems(items: OrderItem[]): InvoiceLineItem[] {
  return items.map((it, idx) => ({
    lineId: `${it.itemId}-${idx}`,
    description: it.variant ? `${it.serviceName} (${it.variant})` : it.serviceName,
    sourceItemId: it.itemId,
    amount: it.finalAmount ?? it.quotedAmount,
  }))
}

export function toInvoice(id: string, d: D): Invoice {
  return {
    id,
    invoiceNumber: d.invoiceNumber,
    orderId: d.orderId,
    customerId: d.customerId,
    customerName: d.customerName ?? '',
    customerPhone: d.customerPhone ?? '',
    lineItems: d.lineItems ?? [],
    discount: d.discount ?? null,
    subtotal: d.subtotal ?? 0,
    discountAmount: d.discountAmount ?? 0,
    total: d.total ?? 0,
    currency: 'BWP',
    status: d.status,
    paymentMethod: d.paymentMethod ?? null,
    proofOfPaymentURL: d.proofOfPaymentURL ?? null,
    proofUploadedAt: d.proofUploadedAt ?? null,
    verifiedBy: d.verifiedBy ?? null,
    verifiedAt: d.verifiedAt ?? null,
    issuedAt: d.issuedAt ?? null,
    paidAt: d.paidAt ?? null,
    createdAt: d.createdAt ?? 0,
    updatedAt: d.updatedAt ?? 0,
    createdBy: d.createdBy ?? '',
  }
}
