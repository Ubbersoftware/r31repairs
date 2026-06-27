// src/app/admin/orders/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const order: Record<string, unknown> = {
  status: 'placed',
  customerId: 'c1',
  orderNumber: 'R31-0042',
  invoiceId: 'inv1',
  items: [
    { itemId: 'i1', deviceId: 'd1', serviceName: 'Screen Replacement', quotedAmount: 80000 },
  ],
  devices: [
    { deviceId: 'd1', modelName: 'iPhone 13' },
  ],
}
const allWrites: Record<string, unknown>[] = []
const revalidated: string[] = []
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/settings/queries', () => ({
  getSettings: async () => ({ warrantyMonths: 3 }),
}))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error(t === 'cust' ? 'FORBIDDEN' : 'UNAUTHENTICATED'); return { uid: 'o1' } },
  getAdminDb: () => ({
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async () => ({ exists: true, data: () => order }),
      update: (_ref: unknown, d: Record<string, unknown>) => { Object.assign(order, d) },
      set: (_ref: unknown, d: Record<string, unknown>) => { allWrites.push(d) },
    }),
    collection: () => ({
      doc: () => ({
        collection: () => ({ doc: () => ({ set: (_d: Record<string, unknown>) => { allWrites.push(_d) } }) }),
        set: (_d: Record<string, unknown>) => { allWrites.push(_d) },
      }),
    }),
  }),
}))
beforeEach(() => {
  Object.keys(order).forEach(k => delete order[k])
  Object.assign(order, {
    id: 'o1', status: 'placed', customerId: 'c1', orderNumber: 'R31-0042', invoiceId: 'inv1',
    items: [{ itemId: 'i1', deviceId: 'd1', serviceName: 'Screen Replacement', quotedAmount: 80000 }],
    devices: [{ deviceId: 'd1', modelName: 'iPhone 13' }],
  })
  allWrites.length = 0
  revalidated.length = 0
})

// helpers to filter writes by shape
const getEvents = () => allWrites.filter((w) => !('link' in w))
const getNotifs = () => allWrites.filter((w) => 'link' in w)

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
    expect(getEvents()[0]).toMatchObject({ type: 'status_change', fromStatus: 'placed', toStatus: 'received', byRole: 'owner', visibility: 'customer' })
    expect(revalidated).toContain('/admin/orders')
  })
  it('writes a status_change notification to the customer', async () => {
    const { changeOrderStatusAction } = await import('./actions')
    await changeOrderStatusAction('owner', 'o1', 'received', undefined)
    const notif = getNotifs()[0]
    expect(notif).toMatchObject({ userId: 'c1', type: 'status_change', link: '/orders/o1', read: false })
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
    expect(getEvents()[0]).toMatchObject({ type: 'line_edit', visibility: 'customer', byRole: 'owner' })
    expect(revalidated).toContain('/admin/orders')
  })
  it('writes a price_update notification to the customer', async () => {
    const { editLineAction } = await import('./actions')
    await editLineAction('owner', 'o1', { itemId: 'i1', finalAmount: 90000 })
    expect(getNotifs().some((n) => n.type === 'price_update' && n.userId === 'c1')).toBe(true)
  })
})

describe('addOrderNoteAction', () => {
  it('appends an internal note when visibility=internal', async () => {
    const { addOrderNoteAction } = await import('./actions')
    const r = await addOrderNoteAction('owner', 'o1', 'check camera', 'internal')
    expect(r).toEqual({ ok: true })
    expect(allWrites[0]).toMatchObject({ type: 'note', note: 'check camera', visibility: 'internal', byRole: 'owner' })
  })
  it('appends a customer note when visibility=customer', async () => {
    const { addOrderNoteAction } = await import('./actions')
    const r = await addOrderNoteAction('owner', 'o1', 'ready for pickup', 'customer')
    expect(r).toEqual({ ok: true })
    expect(allWrites[0]).toMatchObject({ type: 'note', note: 'ready for pickup', visibility: 'customer', byRole: 'owner' })
  })
})

describe('completeCollectionAction', () => {
  it('rejects when the order is not ready', async () => {
    Object.assign(order, { status: 'in_repair' })
    const { completeCollectionAction } = await import('./actions')
    expect(await completeCollectionAction('owner', 'o1', 'https://x/sig.png')).toMatchObject({ ok: false, error: 'INVALID' })
  })
  it('from ready: stores signature, flips to completed, appends event + notifies', async () => {
    Object.assign(order, { status: 'ready' })
    const { completeCollectionAction } = await import('./actions')
    const r = await completeCollectionAction('owner', 'o1', 'https://x/sig.png')
    expect(r).toEqual({ ok: true })
    expect(order.status).toBe('completed')
    expect(order.signatureURL).toBe('https://x/sig.png')
    expect(order.completedAt).toBeTypeOf('number')
    expect(getEvents()[0]).toMatchObject({ type: 'status_change', fromStatus: 'ready', toStatus: 'completed' })
    expect(getNotifs().some((n) => n.type === 'status_change')).toBe(true)
  })
  it('creates one warranty doc per item with correct fields', async () => {
    Object.assign(order, { status: 'ready' })
    const { completeCollectionAction } = await import('./actions')
    const r = await completeCollectionAction('owner', 'o1', 'https://x/sig.png')
    expect(r).toEqual({ ok: true })
    const warranties = allWrites.filter((w) => 'itemId' in w)
    expect(warranties).toHaveLength(1)
    expect(warranties[0]).toMatchObject({
      orderId: 'o1',
      customerId: 'c1',
      invoiceId: 'inv1',
      itemId: 'i1',
      serviceName: 'Screen Replacement',
      phoneModelName: 'iPhone 13',
      status: 'active',
    })
    expect(warranties[0].endDate).toBeTypeOf('number')
    expect(warranties[0].endDate as number).toBeGreaterThan(warranties[0].startDate as number)
  })
})
