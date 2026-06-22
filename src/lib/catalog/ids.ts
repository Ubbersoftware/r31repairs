export function priceId(serviceId: string, modelId: string, variant: string | null): string {
  const v = variant ? variant.toLowerCase() : 'none'
  return `${serviceId}__${modelId}__${v}`
}

export function parsePriceId(id: string): { serviceId: string; modelId: string; variant: string | null } {
  const [serviceId, modelId, v] = id.split('__')
  return { serviceId, modelId, variant: v === 'none' ? null : v }
}
