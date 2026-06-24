// src/app/(customer)/orders/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const writes: Record<string, unknown>[] = []
const revalidated: string[] = []
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyUser: async (t: string) => { if (t !== 'cust') throw new Error('UNAUTHENTICATED'); return { uid: 'u1', name: 'Thabo' } },
  getAdminDb: () => ({
    collection: () => ({ doc: (id?: string) => ({ id: id ?? 'o-gen', set: async (d: Record<string, unknown>) => { writes.push(d) }, collection: () => ({ doc: () => ({ set: async (d: Record<string, unknown>) => { writes.push(d) } }) }) }) }),
  }),
}))
vi.mock('@/lib/orders/orderNumber', () => ({ nextOrderNumber: async () => 'R31-0007' }))
vi.mock('@/lib/catalog/queries', () => ({
  getPriceMatrix: async () => [{ serviceId: 'screen', modelId: 'iphone-13', variant: 'OLED', amount: 150000, available: true }],
  getActiveServices: async () => [{ id: 'screen', name: 'Screen Replacement', slug: 'screen', hasVariants: true, variants: ['Basic', 'OLED'], active: true }],
  getActiveModels: async () => [{ id: 'iphone-13', name: 'iPhone 13', active: true }],
}))
beforeEach(() => { writes.length = 0; revalidated.length = 0 })

const input = { devices: [{ deviceId: 'd1', phoneModelId: 'iphone-13', items: [{ itemId: 'i1', serviceId: 'screen', variant: 'OLED' }] }] }

describe('createOrderAction', () => {
  it('rejects an unauthenticated caller', async () => {
    const { createOrderAction } = await import('./actions')
    expect(await createOrderAction('nope', input)).toMatchObject({ ok: false, error: 'UNAUTHENTICATED' })
  })
  it('recomputes price from the matrix (ignores any client price) and writes the order', async () => {
    const { createOrderAction } = await import('./actions')
    const r = await createOrderAction('cust', input as never)
    expect(r.ok).toBe(true)
    const order = writes.find((w) => (w as { orderNumber?: string }).orderNumber === 'R31-0007') as { items: { quotedAmount: number }[]; estimatedTotal: number; customerId: string }
    expect(order.items[0].quotedAmount).toBe(150000) // from matrix, in thebe
    expect(order.estimatedTotal).toBe(150000)
    expect(order.customerId).toBe('u1') // from verified token, not client
    expect(revalidated).toContain('/account')
  })
})
