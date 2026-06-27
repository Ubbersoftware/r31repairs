import type { ShopSettings } from '@/lib/types/settings'
import { PAYMENT_CHANNELS } from '@/lib/invoices/paymentMethods'
import { WARRANTY_MONTHS } from '@/lib/warranties/expiry'

export const DEFAULT_SETTINGS: ShopSettings = {
  name: '31 Repairs',
  address: '',
  mapURL: '',
  phone: '',
  instagram: '',
  logoURL: null,
  paymentChannels: PAYMENT_CHANNELS,
  warrantyMonths: WARRANTY_MONTHS,
  updatedAt: 0,
  updatedBy: '',
}

export function mergeSettings(stored: Partial<ShopSettings> | null): ShopSettings {
  if (!stored) return { ...DEFAULT_SETTINGS }
  return { ...DEFAULT_SETTINGS, ...stored }
}
