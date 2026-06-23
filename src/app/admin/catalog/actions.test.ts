import { describe, it, expect, vi, beforeEach } from 'vitest'

const writes: Record<string, unknown>[] = []
const revalidated: string[] = []

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { revalidated.push(p) } }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error(t === 'cust' ? 'FORBIDDEN' : 'UNAUTHENTICATED'); return { uid: 'o1' } },
  getAdminDb: () => ({
    batch: () => ({
      set: (_ref: unknown, data: Record<string, unknown>) => { writes.push(data) },
      commit: async () => {},
    }),
    collection: () => ({ doc: () => ({ id: 'x' }) }),
  }),
}))

beforeEach(() => { writes.length = 0; revalidated.length = 0 })

describe('savePricesAction', () => {
  it('rejects a non-owner', async () => {
    const { savePricesAction } = await import('./actions')
    expect(await savePricesAction('cust', [])).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
  it('rejects invalid input', async () => {
    const { savePricesAction } = await import('./actions')
    const r = await savePricesAction('owner', [{ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: -5, available: true }])
    expect(r).toMatchObject({ ok: false, error: 'INVALID' })
  })
  it('writes valid edits and revalidates the public catalog', async () => {
    const { savePricesAction } = await import('./actions')
    const r = await savePricesAction('owner', [{ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 80000, available: true }])
    expect(r).toEqual({ ok: true })
    expect(writes.length).toBe(1)
    expect(revalidated).toContain('/services')
  })
})
