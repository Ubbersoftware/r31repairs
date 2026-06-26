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

const notifs = () => state.writes.filter((w) => w.path.startsWith('r31_notifications')).map((w) => w.data)

describe('issue / pay / verify', () => {
  beforeEach(() => {
    state.invoice = {
      invoiceNumber: 'INV-0007', orderId: 'o1', customerId: 'c1', status: 'draft',
      lineItems: [{ lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 }],
      discount: null, subtotal: 120000, discountAmount: 0, total: 120000,
    }
  })

  it('updateInvoiceAction recomputes totals on a draft', async () => {
    const { updateInvoiceAction } = await import('./actions')
    const r = await updateInvoiceAction('owner', 'inv1', {
      lineItems: [
        { lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 },
        { lineId: 'b', description: 'Seal', sourceItemId: null, amount: 8000 },
      ],
      discount: { type: 'amount', value: 8000 },
    })
    expect(r.ok).toBe(true)
    expect(state.invoice).toMatchObject({ subtotal: 128000, discountAmount: 8000, total: 120000 })
  })

  it('issueInvoiceAction flips draft->issued and notifies the customer', async () => {
    const { issueInvoiceAction } = await import('./actions')
    const r = await issueInvoiceAction('owner', 'inv1')
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('issued')
    expect(state.invoice!.issuedAt).toBeTypeOf('number')
    expect(notifs().some((n) => n.type === 'invoice_issued' && n.userId === 'c1')).toBe(true)
  })

  it('markPaidCashAction flips issued->paid, mirrors order, notifies', async () => {
    state.invoice!.status = 'issued'
    const { markPaidCashAction } = await import('./actions')
    const r = await markPaidCashAction('owner', 'inv1')
    expect(r.ok).toBe(true)
    expect(state.invoice).toMatchObject({ status: 'paid', paymentMethod: 'cash' })
    expect(state.order.paymentStatus).toBe('paid')
    expect(notifs().some((n) => n.type === 'payment_update')).toBe(true)
  })

  it('verifyPaymentAction approve -> paid + mirror', async () => {
    state.invoice = { ...state.invoice, status: 'payment_submitted', paymentMethod: 'orange_money', proofOfPaymentURL: 'u' }
    const { verifyPaymentAction } = await import('./actions')
    const r = await verifyPaymentAction('owner', 'inv1', true)
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('paid')
    expect(state.order.paymentStatus).toBe('paid')
  })

  it('verifyPaymentAction reject -> issued, clears proof, mirrors unpaid', async () => {
    state.order.paymentStatus = 'payment_submitted'
    state.invoice = { ...state.invoice, status: 'payment_submitted', paymentMethod: 'orange_money', proofOfPaymentURL: 'u' }
    const { verifyPaymentAction } = await import('./actions')
    const r = await verifyPaymentAction('owner', 'inv1', false)
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('issued')
    expect(state.invoice!.proofOfPaymentURL).toBeNull()
    expect(state.order.paymentStatus).toBe('unpaid')
  })

  it('cancelInvoiceAction cancels a non-paid invoice', async () => {
    const { cancelInvoiceAction } = await import('./actions')
    const r = await cancelInvoiceAction('owner', 'inv1')
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('cancelled')
  })
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
