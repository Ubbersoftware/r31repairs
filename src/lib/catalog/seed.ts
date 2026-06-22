import { toThebe } from '@/lib/money'
import type { Service, PhoneModel, PriceCell } from '@/lib/types/catalog'

export const SEED_SERVICES: Service[] = [
  {
    id: 'screen',
    name: 'Screen Replacement',
    slug: 'screen',
    category: 'display',
    description:
      'Cracked or unresponsive display? We fit a tested, functional screen — choose Basic or premium OLED.',
    hasVariants: true,
    variants: ['Basic', 'OLED'],
    active: true,
    sortOrder: 1,
    imageURL: null,
  },
  {
    id: 'battery',
    name: 'Battery Replacement',
    slug: 'battery',
    category: 'power',
    description:
      'Phone dying too fast? A fresh battery restores all-day life and full performance.',
    hasVariants: false,
    variants: [],
    active: true,
    sortOrder: 2,
    imageURL: null,
  },
  {
    id: 'back-glass',
    name: 'Back Glass Replacement',
    slug: 'back-glass',
    category: 'body',
    description:
      'Shattered rear glass replaced cleanly so your iPhone looks and feels like new.',
    hasVariants: false,
    variants: [],
    active: true,
    sortOrder: 3,
    imageURL: null,
  },
]

// Per-model seed pricing from PRD Appendix A (BWP, Pula).
// Columns: [battery, screen Basic, screen OLED, back glass].
const MODEL_SEED: { id: string; name: string; prices: [number, number, number, number] }[] = [
  { id: 'iphone-x', name: 'iPhone X', prices: [500, 600, 1000, 500] },
  { id: 'iphone-xs-xr', name: 'iPhone XS / XR', prices: [500, 600, 1000, 500] },
  { id: 'iphone-xs-max', name: 'iPhone XS Max', prices: [600, 700, 1200, 500] },
  { id: 'iphone-11', name: 'iPhone 11', prices: [600, 700, 1500, 500] },
  { id: 'iphone-11-pro', name: 'iPhone 11 Pro', prices: [700, 800, 1700, 700] },
  { id: 'iphone-11-pro-max', name: 'iPhone 11 Pro Max', prices: [800, 900, 2000, 700] },
  { id: 'iphone-12', name: 'iPhone 12', prices: [700, 900, 1800, 600] },
  { id: 'iphone-12-pro', name: 'iPhone 12 Pro', prices: [800, 1000, 2000, 700] },
  { id: 'iphone-12-pro-max', name: 'iPhone 12 Pro Max', prices: [950, 1200, 2500, 800] },
  { id: 'iphone-13', name: 'iPhone 13', prices: [800, 1000, 2000, 800] },
  { id: 'iphone-13-pro', name: 'iPhone 13 Pro', prices: [900, 1400, 2500, 1000] },
  { id: 'iphone-13-pro-max', name: 'iPhone 13 Pro Max', prices: [1000, 1800, 3000, 1000] },
  { id: 'iphone-14', name: 'iPhone 14', prices: [1000, 1400, 3000, 900] },
  { id: 'iphone-14-pro-plus', name: 'iPhone 14 Pro / 14 Plus', prices: [1200, 1800, 3500, 1200] },
  { id: 'iphone-14-pro-max', name: 'iPhone 14 Pro Max', prices: [1500, 2500, 4000, 1500] },
  { id: 'iphone-15', name: 'iPhone 15', prices: [1500, 1800, 4500, 1500] },
  { id: 'iphone-15-pro-plus', name: 'iPhone 15 Pro / 15 Plus', prices: [2000, 3000, 5000, 1800] },
  { id: 'iphone-15-pro-max', name: 'iPhone 15 Pro Max', prices: [2500, 3500, 6000, 2000] },
]

export const SEED_MODELS: PhoneModel[] = MODEL_SEED.map((m, i) => ({
  id: m.id,
  name: m.name,
  brand: 'Apple',
  active: true,
  sortOrder: i + 1,
}))

export const SEED_PRICES: PriceCell[] = MODEL_SEED.flatMap((m) => {
  const [battery, basic, oled, backGlass] = m.prices
  return [
    { serviceSlug: 'battery', modelId: m.id, variant: null, amount: toThebe(battery), available: true },
    { serviceSlug: 'screen', modelId: m.id, variant: 'Basic', amount: toThebe(basic), available: true },
    { serviceSlug: 'screen', modelId: m.id, variant: 'OLED', amount: toThebe(oled), available: true },
    { serviceSlug: 'back-glass', modelId: m.id, variant: null, amount: toThebe(backGlass), available: true },
  ]
})
