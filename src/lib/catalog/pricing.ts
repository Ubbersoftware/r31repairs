import type { PriceDoc } from '@/lib/types/catalog'

export function priceFor(
  matrix: PriceDoc[], serviceId: string, modelId: string, variant: string | null = null,
): number | null {
  const cell = matrix.find(
    (p) => p.serviceId === serviceId && p.modelId === modelId &&
      (p.variant ?? null) === (variant ?? null) && p.available,
  )
  return cell ? cell.amount : null
}

export function fromPrice(matrix: PriceDoc[], serviceId: string): number | null {
  const cells = matrix.filter((p) => p.serviceId === serviceId && p.available)
  return cells.length ? Math.min(...cells.map((c) => c.amount)) : null
}
