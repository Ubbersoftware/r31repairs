import type { InvoiceLineItem, Discount } from '@/lib/types/invoice'

export function subtotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, it) => sum + it.amount, 0)
}

export function discountAmount(sub: number, discount: Discount | null): number {
  if (!discount) return 0
  if (discount.type === 'amount') return Math.min(discount.value, sub)
  return Math.min(Math.round((sub * discount.value) / 100), sub)
}

export function computeTotals(items: InvoiceLineItem[], discount: Discount | null) {
  const sub = subtotal(items)
  const disc = discountAmount(sub, discount)
  return { subtotal: sub, discountAmount: disc, total: Math.max(sub - disc, 0) }
}
