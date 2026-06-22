import { describe, it, expect } from 'vitest'
import { toService, toFaq, toPriceDoc } from './mappers'

describe('mappers', () => {
  it('toService fills defaults for missing optional fields', () => {
    const s = toService('screen', { name: 'Screen Replacement', slug: 'screen', category: 'display', description: 'd', hasVariants: true, variants: ['Basic', 'OLED'], active: true, sortOrder: 1 })
    expect(s).toMatchObject({ id: 'screen', imageURL: null, hasVariants: true })
  })
  it('toPriceDoc coerces variant undefined to null', () => {
    expect(toPriceDoc({ serviceId: 'battery', modelId: 'iphone-13', amount: 80000, available: true }).variant).toBeNull()
  })
  it('toFaq maps fields', () => {
    expect(toFaq('faq-1', { question: 'q', answer: 'a', category: 'general', active: true, sortOrder: 1 }).question).toBe('q')
  })
})
