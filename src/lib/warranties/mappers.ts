import type { Warranty, Claim, WarrantyStatus, ClaimStatus } from '@/lib/types/warranty'
import type { Order } from '@/lib/types/order'
import { addMonths } from './expiry'

type D = Record<string, any>

export interface WarrantyDraft {
  orderId: string
  customerId: string
  invoiceId: string | null
  itemId: string
  serviceName: string
  phoneModelName: string
  startDate: number
  endDate: number
  status: 'active'
  createdAt: number
}

export function orderToWarrantyDrafts(order: Order, warrantyMonths: number, now: number): WarrantyDraft[] {
  return order.items.map((item) => {
    const device = order.devices.find((d) => d.deviceId === item.deviceId)
    return {
      orderId: order.id,
      customerId: order.customerId,
      invoiceId: order.invoiceId ?? null,
      itemId: item.itemId,
      serviceName: item.serviceName,
      phoneModelName: device?.modelName ?? '',
      startDate: now,
      endDate: addMonths(now, warrantyMonths),
      status: 'active' as const,
      createdAt: now,
    }
  })
}

export function toWarranty(id: string, d: D): Warranty {
  return {
    id,
    orderId: d.orderId ?? '',
    customerId: d.customerId ?? '',
    invoiceId: d.invoiceId ?? null,
    itemId: d.itemId ?? '',
    serviceName: d.serviceName ?? '',
    phoneModelName: d.phoneModelName ?? '',
    startDate: d.startDate ?? 0,
    endDate: d.endDate ?? 0,
    status: (d.status as WarrantyStatus) ?? 'active',
    createdAt: d.createdAt ?? 0,
    updatedAt: d.updatedAt ?? undefined,
  }
}

export function toClaim(id: string, d: D): Claim {
  return {
    id,
    warrantyId: d.warrantyId ?? '',
    customerId: d.customerId ?? '',
    description: d.description ?? '',
    photoURLs: d.photoURLs ?? [],
    status: (d.status as ClaimStatus) ?? 'received',
    adminNotes: d.adminNotes ?? null,
    createdAt: d.createdAt ?? 0,
    updatedAt: d.updatedAt ?? 0,
  }
}
