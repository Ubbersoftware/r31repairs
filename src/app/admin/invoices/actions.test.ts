// src/app/admin/invoices/actions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = {
  order: {} as Record<string, any>,
  invoice: null as Record<string, any> | null,
  writes: [] as { path: string; data: Record<string, any> }[],
  revalidated: [] as string[],
}

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => state.revalidated.push(p) }))
vi.mock('@/lib/invoices/invoiceNumber', () => ({
  nextInvoiceNumber: async () => 'INV-0007',
}))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error('FORBIDDEN'); return { uid: 'o1' } },
  getAdminDb: () => makeDb(),
}))

// Routes tx.get/update/set by ref.path; order doc id 'o1', invoice doc id 'inv1'.
function makeDb() {
  const ref = (path: string) => ({
    path,
    id: path.split('/').pop()!,
    collection: (c: string) => ({ doc: (id?: string) => ref(`${path}/${c}/${id ?? 'auto'}`) }),
  })
  const dataFor = (path: string) =>
    path.startsWith('r31_orders') ? state.order : state.invoice
  const applyUpdate = (path: string, d: Record<string, any>) => {
    if (path.startsWith('r31_orders')) Object.assign(state.order, d)
    else state.invoice = { ...(state.invoice ?? {}), ...d }
  }
  return {
    collection: (c: string) => ({ doc: (id?: string) => ref(`${c}/${id ?? 'inv1'}`) }),
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => fn({
      get: async (r: { path: string }) => {
        const d = dataFor(r.path)
        return { exists: !!d && Object.keys(d).length > 0, data: () => d }
      },
      update: (r: { path: string }, d: Record<string, any>) => applyUpdate(r.path, d),
      set: (r: { path: string }, d: Record<string, any>) => {
        state.writes.push({ path: r.path, data: d })
        applyUpdate(r.path, d)
      },
    }),
  }
}

beforeEach(() => {
  state.order = {
    orderNumber: 'R31-0042', customerId: 'c1', customerName: 'Thabo', customerPhone: '7',
    status: 'ready', paymentStatus: 'unpaid', invoiceId: null,
    items: [
      { itemId: 'i1', serviceName: 'Screen Replacement', variant: 'OLED', quotedAmount: 120000, lineStatus: 'placed' },
      { itemId: 'i2', serviceName: 'Battery', variant: null, quotedAmount: 35000, finalAmount: 40000, lineStatus: 'placed' },
    ],
  }
  state.invoice = null
  state.writes.length = 0
  state.revalidated.length = 0
})

describe('createInvoiceAction', () => {
  it('rejects a non-owner', async () => {
    const { createInvoiceAction } = await import('./actions')
    expect(await createInvoiceAction('cust', 'o1')).toMatchObject({ ok: false, error: 'FORBIDDEN' })
  })
  it('snapshots order items into a draft invoice and links it to the order', async () => {
    const { createInvoiceAction } = await import('./actions')
    const r = await createInvoiceAction('owner', 'o1')
    expect(r.ok).toBe(true)
    const inv = state.writes.find((w) => w.path.startsWith('r31_invoices'))!.data
    expect(inv).toMatchObject({ invoiceNumber: 'INV-0007', status: 'draft', orderId: 'o1', customerId: 'c1', total: 160000 })
    expect(inv.lineItems).toHaveLength(2)
    expect(state.order.invoiceId).toBe('inv1')
  })
  it('refuses to create a second invoice when one already exists', async () => {
    state.order.invoiceId = 'existing'
    const { createInvoiceAction } = await import('./actions')
    expect(await createInvoiceAction('owner', 'o1')).toMatchObject({ ok: false, error: 'INVALID' })
  })
})
