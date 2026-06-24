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
