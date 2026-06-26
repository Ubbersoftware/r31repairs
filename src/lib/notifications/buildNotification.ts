// src/lib/notifications/buildNotification.ts
import type { Notification } from '@/lib/types/notification'
import { statusMeta, type OrderStatus } from '@/lib/types/order'

type Body = Omit<Notification, 'id'>

export function buildStatusNotification(args: {
  userId: string; orderId: string; orderNumber: string; toStatus: OrderStatus; now: number
}): Body {
  return {
    userId: args.userId, type: 'status_change', title: args.orderNumber,
    body: `Status: ${statusMeta[args.toStatus].label}`,
    link: `/orders/${args.orderId}`, read: false, createdAt: args.now,
  }
}

export function buildPriceNotification(args: {
  userId: string; orderId: string; orderNumber: string; now: number
}): Body {
  return {
    userId: args.userId, type: 'price_update', title: args.orderNumber,
    body: 'Your quote was updated',
    link: `/orders/${args.orderId}`, read: false, createdAt: args.now,
  }
}

export function buildInvoiceNotification(args: {
  userId: string; orderId: string; orderNumber: string; now: number
}): Body {
  return {
    userId: args.userId, type: 'invoice_issued', title: args.orderNumber,
    body: 'Your invoice is ready',
    link: `/orders/${args.orderId}`, read: false, createdAt: args.now,
  }
}

export function buildPaymentNotification(args: {
  userId: string; orderId: string; orderNumber: string; paid: boolean; now: number
}): Body {
  return {
    userId: args.userId, type: 'payment_update', title: args.orderNumber,
    body: args.paid ? 'Payment confirmed' : 'Payment proof was not accepted',
    link: `/orders/${args.orderId}`, read: false, createdAt: args.now,
  }
}

export function buildClaimNotification(args: {
  userId: string; warrantyId: string; status: string; now: number
}): Body {
  const labels: Record<string, string> = {
    assessing: 'Your claim is being assessed',
    resolved: 'Your warranty claim has been resolved',
    rejected: 'Your warranty claim was not accepted',
  }
  return {
    userId: args.userId,
    type: 'claim_update',
    title: 'Warranty claim update',
    body: labels[args.status] ?? `Your claim status: ${args.status}`,
    link: '/account',
    read: false,
    createdAt: args.now,
  }
}
