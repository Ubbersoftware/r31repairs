// src/app/admin/orders/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const order = { status: 'placed' as string }
const events: Record<string, unknown>[] = []
const revalidated: string[] = []
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error(t === 'cust' ? 'FORBIDDEN' : 'UNAUTHENTICATED'); return { uid: 'o1' } },
  getAdminDb: () => ({
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async () => ({ exists: true, data: () => order }),
      update: (_ref: unknown, d: Record<string, unknown>) => { order.status = d.status as string },
      set: (_ref: unknown, d: Record<string, unknown>) => { events.push(d) },
    }),
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({}) }) }) }),
  }),
}))
beforeEach(() => { order.status = 'placed'; events.length = 0; revalidated.length = 0 })

describe('changeOrderStatusAction', () => {
  it('rejects a non-owner', async () => {
    const { changeOrderStatusAction } = await import('./actions')
    expect(await changeOrderStatusAction('cust', 'o1', 'received')).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
  it('updates status + appends a status_change event', async () => {
    const { changeOrderStatusAction } = await import('./actions')
    const r = await changeOrderStatusAction('owner', 'o1', 'received', 'took it in')
    expect(r).toEqual({ ok: true })
    expect(order.status).toBe('received')
    expect(events[0]).toMatchObject({ type: 'status_change', fromStatus: 'placed', toStatus: 'received', byRole: 'owner', visibility: 'customer' })
    expect(revalidated).toContain('/admin/orders')
  })
})
