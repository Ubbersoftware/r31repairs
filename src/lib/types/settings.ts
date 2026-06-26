import type { PaymentChannel } from '@/lib/invoices/paymentMethods'

export interface ShopSettings {
  name: string
  address: string
  mapURL: string
  phone: string
  instagram: string
  logoURL: string | null
  paymentChannels: PaymentChannel[]
  warrantyMonths: number
  updatedAt: number
  updatedBy: string
}
