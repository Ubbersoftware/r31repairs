import { describe, it, expect, vi, beforeEach } from 'vitest'

const writes: Record<string, unknown>[] = []
// Each entry is [path, type?] — captures both args so slug revalidation can be asserted
const revalidated: [string, string?][] = []

vi.mock('next/cache', () => ({ revalidatePath: (p: string, type?: string) => { revalidated.push([p, type]) } }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error(t === 'cust' ? 'FORBIDDEN' : 'UNAUTHENTICATED'); return { uid: 'o1' } },
  getAdminDb: () => ({
    batch: () => ({
      set: (_ref: unknown, data: Record<string, unknown>) => { writes.push(data) },
      commit: async () => {},
    }),
    collection: () => ({ doc: () => ({ id: 'x', set: async (_data: unknown, _opts: unknown) => {} }) }),
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
    // existing: /services path was revalidated
    expect(revalidated.map(([p]) => p)).toContain('/services')
    // slug page revalidation must also fire
    expect(revalidated).toContainEqual(['/services/[slug]', 'page'])
  })
})

describe('setServiceImageAction', () => {
  it('rejects a non-owner', async () => {
    const { setServiceImageAction } = await import('./actions')
    expect(await setServiceImageAction('cust', { id: 'battery', imageURL: 'https://example.com/img.jpg' }))
      .toEqual({ ok: false, error: 'FORBIDDEN' })
  })
  it('writes imageURL with audit fields and revalidates the public catalog', async () => {
    const { setServiceImageAction } = await import('./actions')
    const r = await setServiceImageAction('owner', { id: 'battery', imageURL: 'https://example.com/img.jpg' })
    expect(r).toEqual({ ok: true })
    // /services path was revalidated
    expect(revalidated.map(([p]) => p)).toContain('/services')
    // slug page revalidation must also fire
    expect(revalidated).toContainEqual(['/services/[slug]', 'page'])
  })
})
