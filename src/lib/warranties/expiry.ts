import type { WarrantyStatus, WarrantyState } from '@/lib/types/warranty'

export const WARRANTY_MONTHS = 3

export function addMonths(startMs: number, months: number): number {
  const d = new Date(startMs)
  const targetMonth = d.getMonth() + months
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  d.setFullYear(targetYear, normalizedMonth, Math.min(d.getDate(), lastDay))
  return d.getTime()
}

export function warrantyState(
  w: { status: WarrantyStatus; endDate: number },
  now: number,
): WarrantyState {
  if (w.status === 'claimed') return 'claimed'
  if (now > w.endDate) return 'expired'
  return 'active'
}
