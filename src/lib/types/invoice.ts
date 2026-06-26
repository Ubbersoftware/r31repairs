// src/lib/types/invoice.ts
import type { PaymentMethod } from '@/lib/invoices/paymentMethods'

export type InvoiceStatus = 'draft' | 'issued' | 'payment_submitted' | 'paid' | 'cancelled'

export interface Discount {
  type: 'amount' | 'percent'
  value: number // amount: thebe; percent: 0-100 whole number
}

export interface InvoiceLineItem {
  lineId: string
  description: string
  sourceItemId: string | null // null = ad-hoc line added on the invoice
  amount: number // thebe
}

export interface Invoice {
  id: string
  invoiceNumber: string
  orderId: string
  customerId: string
  customerName: string
  customerPhone: string
  lineItems: InvoiceLineItem[]
  discount: Discount | null
  subtotal: number
  discountAmount: number
  total: number
  currency: 'BWP'
  status: InvoiceStatus
  paymentMethod: PaymentMethod | null
  proofOfPaymentURL: string | null
  proofUploadedAt: number | null
  verifiedBy: string | null
  verifiedAt: number | null
  issuedAt: number | null
  paidAt: number | null
  createdAt: number
  updatedAt: number
  createdBy: string
}
