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
