// src/lib/types/order.ts
export const ORDER_STATUSES = [
  'placed', 'received', 'diagnosing', 'awaiting_approval',
  'in_repair', 'awaiting_parts', 'ready', 'completed', 'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const statusMeta: Record<OrderStatus, { label: string; token: string; hold: boolean }> = {
  placed:            { label: 'Order Placed',          token: '--text-muted',    hold: false },
  received:          { label: 'Device Received',       token: '--status-blue',   hold: false },
  diagnosing:        { label: 'Diagnosing',            token: '--warning',       hold: false },
  awaiting_approval: { label: 'Awaiting Approval',     token: '--warning',       hold: true  },
  in_repair:         { label: 'In Repair',             token: '--accent',        hold: false },
  awaiting_parts:    { label: 'Awaiting Parts',        token: '--status-purple', hold: true  },
  ready:             { label: 'Ready for Collection',  token: '--success',       hold: false },
  completed:         { label: 'Completed',             token: '--success',       hold: false },
  cancelled:         { label: 'Cancelled',             token: '--danger',        hold: false },
}

export interface OrderDevice {
  deviceId: string
  phoneModelId: string
  modelName: string
  label?: string
  notes?: string
}

export interface OrderItem {
  itemId: string
  deviceId: string
  serviceId: string
  serviceName: string
  variant: string | null
  quotedAmount: number
  finalAmount?: number
  lineStatus: OrderStatus
  completedAt?: number | null
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  customerPhone: string
  status: OrderStatus
  paymentStatus: 'unpaid' | 'payment_submitted' | 'paid'
  invoiceId: string | null
  devices: OrderDevice[]
  items: OrderItem[]
  estimatedTotal: number
  finalTotal?: number
  signatureURL?: string
  signedAt?: number
  completedAt?: number
  createdAt: number
  updatedAt: number
}

export type OrderEventType = 'created' | 'status_change' | 'line_edit' | 'note'

export interface OrderEvent {
  id: string
  type: OrderEventType
  fromStatus?: OrderStatus
  toStatus?: OrderStatus
  note?: string
  visibility: 'customer' | 'internal'
  byUserId: string
  byRole: string
  at: number
}
