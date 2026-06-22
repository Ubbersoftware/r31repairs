import type { Service, PhoneModel, PriceDoc, Faq } from '@/lib/types/catalog'

type D = Record<string, any>

export function toService(id: string, d: D): Service {
  return {
    id, name: d.name, slug: d.slug ?? id, category: d.category ?? '',
    description: d.description ?? '', hasVariants: !!d.hasVariants,
    variants: d.variants ?? [], active: !!d.active, sortOrder: d.sortOrder ?? 0,
    imageURL: d.imageURL !== undefined ? d.imageURL : null,
  }
}

export function toPhoneModel(id: string, d: D): PhoneModel {
  return { id, name: d.name, brand: d.brand ?? 'Apple', active: !!d.active, sortOrder: d.sortOrder ?? 0 }
}

export function toPriceDoc(d: D): PriceDoc {
  return {
    serviceId: d.serviceId, modelId: d.modelId, variant: d.variant ?? null,
    amount: d.amount, available: !!d.available, updatedAt: d.updatedAt, updatedBy: d.updatedBy,
  }
}

export function toFaq(id: string, d: D): Faq {
  return { id, question: d.question, answer: d.answer, category: d.category ?? 'general', active: !!d.active, sortOrder: d.sortOrder ?? 0 }
}
