// src/app/admin/warranties/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const claim = { customerId: 'c1', status: 'received', adminNotes: null }
const writes: Record<string, unknown>[] = []
const revalidated: string[] = []

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => {
    if (t !== 'owner') throw new Error('FORBIDDEN')
    return { uid: 'o1' }
  },
  getAdminDb: () => ({
    collection: () => ({
      doc: (id?: string) => ({
        collection: () => ({
          doc: () => ({ path: `r31_warranties/w1/claims/cl1` }),
        }),
      }),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async () => ({ exists: true, data: () => claim }),
      update: (_: unknown, d: Record<string, unknown>) => Object.assign(claim, d),
      set: (_: unknown, d: Record<string, unknown>) => writes.push(d),
    }),
  }),
}))

beforeEach(() => {
  Object.assign(claim, { customerId: 'c1', status: 'received', adminNotes: null })
  writes.length = 0
  revalidated.length = 0
})

describe('updateClaimAction', () => {
  it('rejects non-owner', async () => {
    const { updateClaimAction } = await import('./actions')
    expect(await updateClaimAction('cust', 'w1', 'cl1', { status: 'assessing', adminNotes: null })).toMatchObject({ ok: false })
  })
  it('rejects invalid status', async () => {
    const { updateClaimAction } = await import('./actions')
    expect(await updateClaimAction('owner', 'w1', 'cl1', { status: 'pending', adminNotes: null })).toMatchObject({ ok: false })
  })
  it('updates claim status + adminNotes', async () => {
    const { updateClaimAction } = await import('./actions')
    const r = await updateClaimAction('owner', 'w1', 'cl1', { status: 'assessing', adminNotes: 'looking into it' })
    expect(r).toEqual({ ok: true })
    expect(claim.status).toBe('assessing')
    expect(claim.adminNotes).toBe('looking into it')
  })
  it('writes a claim_update notification to the customer', async () => {
    const { updateClaimAction } = await import('./actions')
    await updateClaimAction('owner', 'w1', 'cl1', { status: 'resolved', adminNotes: null })
    expect(writes.some((w) => w.type === 'claim_update' && w.userId === 'c1')).toBe(true)
  })
  it('revalidates admin warranties path', async () => {
    const { updateClaimAction } = await import('./actions')
    await updateClaimAction('owner', 'w1', 'cl1', { status: 'resolved', adminNotes: null })
    expect(revalidated).toContain('/admin/warranties')
  })
})
