// src/app/admin/orders/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const order: Record<string, unknown> = { status: 'placed', items: [{ itemId: 'i1', quotedAmount: 80000 }] }
const events: Record<string, unknown>[] = []
const revalidated: string[] = []
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error(t === 'cust' ? 'FORBIDDEN' : 'UNAUTHENTICATED'); return { uid: 'o1' } },
  getAdminDb: () => ({
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async () => ({ exists: true, data: () => order }),
      update: (_ref: unknown, d: Record<string, unknown>) => { Object.assign(order, d) },
      set: (_ref: unknown, d: Record<string, unknown>) => { events.push(d) },
    }),
    collection: () => ({
      doc: () => ({
        collection: () => ({ doc: () => ({ set: (_d: Record<string, unknown>) => { events.push(_d) } }) }),
        set: (_d: Record<string, unknown>) => { events.push(_d) },
      }),
    }),
  }),
}))
beforeEach(() => {
  order.status = 'placed'
  order.items = [{ itemId: 'i1', quotedAmount: 80000 }]
  events.length = 0
  revalidated.length = 0
})

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

describe('editLineAction', () => {
  it('rejects a non-owner', async () => {
    const { editLineAction } = await import('./actions')
    expect(await editLineAction('cust', 'o1', { itemId: 'i1', finalAmount: 90000 })).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
  it('updates item finalAmount, recomputes finalTotal, appends a line_edit event', async () => {
    const { editLineAction } = await import('./actions')
    const r = await editLineAction('owner', 'o1', { itemId: 'i1', finalAmount: 90000 })
    expect(r).toEqual({ ok: true })
    expect(order.finalTotal).toBe(90000)
    expect(events[0]).toMatchObject({ type: 'line_edit', visibility: 'customer', byRole: 'owner' })
    expect(revalidated).toContain('/admin/orders')
  })
})

describe('addOrderNoteAction', () => {
  it('appends an internal note when visibility=internal', async () => {
    const { addOrderNoteAction } = await import('./actions')
    const r = await addOrderNoteAction('owner', 'o1', 'check camera', 'internal')
    expect(r).toEqual({ ok: true })
    expect(events[0]).toMatchObject({ type: 'note', note: 'check camera', visibility: 'internal', byRole: 'owner' })
  })
  it('appends a customer note when visibility=customer', async () => {
    const { addOrderNoteAction } = await import('./actions')
    const r = await addOrderNoteAction('owner', 'o1', 'ready for pickup', 'customer')
    expect(r).toEqual({ ok: true })
    expect(events[0]).toMatchObject({ type: 'note', note: 'ready for pickup', visibility: 'customer', byRole: 'owner' })
  })
})
