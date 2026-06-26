// src/app/(customer)/warranties/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const warranty = { status: 'active', customerId: 'c1', endDate: Date.now() + 9_999_999 }
const writes: Record<string, unknown>[] = []
const revalidated: string[] = []

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyUser: async (t: string) => {
    if (t !== 'cust') throw new Error('UNAUTHENTICATED')
    return { uid: 'c1' }
  },
  getAdminDb: () => ({
    collection: (col: string) => ({
      doc: (id?: string) => ({
        path: `${col}/${id ?? 'w1'}`,
        collection: (sub: string) => ({ doc: () => ({ path: `${col}/${id}/${sub}/cl1` }) }),
      }),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async () => ({ exists: true, data: () => warranty }),
      update: (_: unknown, d: Record<string, unknown>) => Object.assign(warranty, d),
      set: (_: unknown, d: Record<string, unknown>) => writes.push(d),
    }),
  }),
}))

beforeEach(() => {
  Object.assign(warranty, { status: 'active', customerId: 'c1', endDate: Date.now() + 9_999_999 })
  writes.length = 0
  revalidated.length = 0
})

describe('raiseClaimAction', () => {
  it('rejects unauthenticated', async () => {
    const { raiseClaimAction } = await import('./actions')
    expect(await raiseClaimAction('bad', 'w1', { description: 'broken', photoURLs: [] })).toMatchObject({ ok: false })
  })
  it('rejects if warranty belongs to a different customer', async () => {
    Object.assign(warranty, { customerId: 'other' })
    const { raiseClaimAction } = await import('./actions')
    expect(await raiseClaimAction('cust', 'w1', { description: 'broken', photoURLs: [] })).toMatchObject({ ok: false })
  })
  it('rejects if warranty is already claimed', async () => {
    Object.assign(warranty, { status: 'claimed' })
    const { raiseClaimAction } = await import('./actions')
    expect(await raiseClaimAction('cust', 'w1', { description: 'broken', photoURLs: [] })).toMatchObject({ ok: false })
  })
  it('rejects if warranty is expired', async () => {
    Object.assign(warranty, { endDate: Date.now() - 1 })
    const { raiseClaimAction } = await import('./actions')
    expect(await raiseClaimAction('cust', 'w1', { description: 'broken', photoURLs: [] })).toMatchObject({ ok: false })
  })
  it('creates claim doc with status received + flips warranty to claimed', async () => {
    const { raiseClaimAction } = await import('./actions')
    const r = await raiseClaimAction('cust', 'w1', { description: 'screen cracked', photoURLs: ['https://x.com/a.png'] })
    expect(r).toEqual({ ok: true })
    expect(warranty.status).toBe('claimed')
    expect(writes.some((w) => w.status === 'received' && w.description === 'screen cracked')).toBe(true)
  })
})
