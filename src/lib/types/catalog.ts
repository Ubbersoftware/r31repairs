export interface Service {
  id: string
  name: string
  slug: string
  category: string
  description: string
  hasVariants: boolean
  variants: string[]
  active: boolean
  sortOrder: number
  imageURL: string | null
}

export interface PhoneModel {
  id: string
  name: string
  brand: string
  active: boolean
  sortOrder: number
}

export interface PriceCell {
  serviceSlug: string
  modelId: string
  variant: string | null
  amount: number
  available: boolean
}

export interface Faq {
  id: string
  question: string
  answer: string
  category: string
  active: boolean
  sortOrder: number
}

// Firestore document shape for prices (composite-ID keyed). serviceId = slug.
export interface PriceDoc {
  serviceId: string
  modelId: string
  variant: string | null
  amount: number // thebe
  available: boolean
  updatedAt?: number // epoch ms
  updatedBy?: string // uid
}
