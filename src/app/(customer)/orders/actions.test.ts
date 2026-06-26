// src/app/(customer)/orders/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const writes: Record<string, unknown>[] = []
const revalidated: string[] = []

const state = {
  invoice: null as Record<string, any> | null,
  order: null as Record<string, any> | null,
}

function makeRef(path: string): any {
  return {
    path,
    id: path.split('/').pop()!,
    set: async (d: Record<string, any>) => { writes.push(d) },
    collection: (c: string) => ({ doc: (id?: string) => makeRef(`${path}/${c}/${id ?? 'sub-gen'}`) }),
  }
}

function makeDb() {
  return {
    collection: (c: string) => ({
      doc: (id?: string) => makeRef(`${c}/${id ?? 'gen-id'}`),
    }),
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => fn({
      get: async (r: { path: string }) => {
        const d = r.path.includes('r31_invoices') ? state.invoice : state.order
        return { exists: !!d, data: () => d }
      },
      update: (r: { path: string }, d: Record<string, any>) => {
        if (r.path.includes('r31_invoices')) Object.assign(state.invoice!, d)
        else Object.assign(state.order!, d)
      },
    }),
  }
}

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyUser: async (t: string) => {
    if (t === 'nope') throw new Error('UNAUTHENTICATED')
    return { uid: t === 'cust' ? 'u1' : t, name: 'Thabo' }
  },
  getAdminDb: () => makeDb(),
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

describe('submitProofOfPaymentAction', () => {
  beforeEach(() => {
    state.invoice = { invoiceNumber: 'INV-0001', orderId: 'o1', customerId: 'c1', status: 'issued' }
    state.order = { paymentStatus: 'unpaid' }
  })

  it('rejects when the caller is not the invoice customer', async () => {
    const { submitProofOfPaymentAction } = await import('./actions')
    const r = await submitProofOfPaymentAction('other', 'inv1', 'orange_money', 'https://x/p.png')
    expect(r).toMatchObject({ ok: false, error: 'FORBIDDEN' })
  })

  it('from issued: records method+proof, flips to payment_submitted, mirrors order', async () => {
    const { submitProofOfPaymentAction } = await import('./actions')
    const r = await submitProofOfPaymentAction('c1', 'inv1', 'orange_money', 'https://x/p.png')
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('payment_submitted')
    expect(state.order!.paymentStatus).toBe('payment_submitted')
  })

  it('rejects a cash method', async () => {
    const { submitProofOfPaymentAction } = await import('./actions')
    expect(await submitProofOfPaymentAction('c1', 'inv1', 'cash' as never, 'https://x/p.png')).toMatchObject({ ok: false, error: 'INVALID' })
  })
})
