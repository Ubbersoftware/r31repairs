import { SEED_PRICES } from './seed'

export function priceFor(serviceSlug: string, modelId: string, variant: string | null = null): number | null {
  const cell = SEED_PRICES.find(
    (p) =>
      p.serviceSlug === serviceSlug &&
      p.modelId === modelId &&
      (p.variant ?? null) === (variant ?? null) &&
      p.available,
  )
  return cell ? cell.amount : null
}

export function fromPrice(serviceSlug: string): number | null {
  const cells = SEED_PRICES.filter((p) => p.serviceSlug === serviceSlug && p.available)
  return cells.length ? Math.min(...cells.map((c) => c.amount)) : null
}
