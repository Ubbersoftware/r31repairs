// src/app/admin/invoices/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { nextInvoiceNumber } from '@/lib/invoices/invoiceNumber'
import { orderItemsToLineItems } from '@/lib/invoices/mappers'
import { computeTotals } from '@/lib/invoices/totals'
import { updateInvoiceSchema } from '@/lib/invoices/validation'
import { buildInvoiceNotification, buildPaymentNotification } from '@/lib/notifications/buildNotification'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'
import type { OrderItem } from '@/lib/types/order'

function revalidateInvoice(orderId: string) {
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/invoices')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/account')
}

export async function createInvoiceAction(
  idToken: string,
  orderId: string,
): Promise<ActionResult & { invoiceId?: string }> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }

  const db = getAdminDb()
  const orderRef = db.collection('r31_orders').doc(orderId)
  const invoiceRef = db.collection('r31_invoices').doc()
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef)
      if (!snap.exists) throw new Error('INVALID')
      const order = snap.data()!
      if (order.invoiceId) throw new Error('INVALID') // already invoiced (cancel first to re-invoice)
      const lineItems = orderItemsToLineItems((order.items ?? []) as OrderItem[])
      const totals = computeTotals(lineItems, null)
      const now = Date.now()
      const invoiceNumber = await nextInvoiceNumber(db)
      tx.set(invoiceRef, {
        invoiceNumber, orderId, customerId: order.customerId,
        customerName: order.customerName ?? '', customerPhone: order.customerPhone ?? '',
        lineItems, discount: null, ...totals, currency: 'BWP', status: 'draft',
        paymentMethod: null, proofOfPaymentURL: null, proofUploadedAt: null,
        verifiedBy: null, verifiedAt: null, issuedAt: null, paidAt: null,
        createdAt: now, updatedAt: now, createdBy: uid,
      })
      tx.update(orderRef, { invoiceId: invoiceRef.id, updatedAt: now })
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true, invoiceId: invoiceRef.id }
}

export async function updateInvoiceAction(
  idToken: string, invoiceId: string,
  input: { lineItems: unknown; discount: unknown },
): Promise<ActionResult> {
  let _uid: string
  try { _uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = updateInvoiceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status !== 'draft') throw new Error('INVALID')
      const totals = computeTotals(parsed.data.lineItems, parsed.data.discount)
      tx.update(ref, { lineItems: parsed.data.lineItems, discount: parsed.data.discount, ...totals, updatedAt: Date.now() })
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}

export async function issueInvoiceAction(idToken: string, invoiceId: string): Promise<ActionResult> {
  let _uid: string
  try { _uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  const notifRef = db.collection('r31_notifications').doc()
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status !== 'draft') throw new Error('INVALID')
      const now = Date.now()
      tx.update(ref, { status: 'issued', issuedAt: now, updatedAt: now })
      tx.set(notifRef, buildInvoiceNotification({ userId: inv.customerId, orderId: inv.orderId, orderNumber: inv.invoiceNumber, now }))
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}

export async function markPaidCashAction(idToken: string, invoiceId: string): Promise<ActionResult> {
  return settlePayment(idToken, invoiceId, { method: 'cash', verifierUid: null })
}

export async function verifyPaymentAction(idToken: string, invoiceId: string, approve: boolean): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  const notifRef = db.collection('r31_notifications').doc()
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status !== 'payment_submitted') throw new Error('INVALID')
      const now = Date.now()
      const orderRef = db.collection('r31_orders').doc(inv.orderId)
      if (approve) {
        tx.update(ref, { status: 'paid', verifiedBy: uid, verifiedAt: now, paidAt: now, updatedAt: now })
        tx.update(orderRef, { paymentStatus: 'paid', updatedAt: now })
      } else {
        tx.update(ref, { status: 'issued', proofOfPaymentURL: null, proofUploadedAt: null, updatedAt: now })
        tx.update(orderRef, { paymentStatus: 'unpaid', updatedAt: now })
      }
      tx.set(notifRef, buildPaymentNotification({ userId: inv.customerId, orderId: inv.orderId, orderNumber: inv.invoiceNumber, paid: approve, now }))
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}

async function settlePayment(
  idToken: string, invoiceId: string, opts: { method: 'cash'; verifierUid: string | null },
): Promise<ActionResult> {
  let _uid: string
  try { _uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  const notifRef = db.collection('r31_notifications').doc()
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status !== 'issued') throw new Error('INVALID')
      const now = Date.now()
      tx.update(ref, { status: 'paid', paymentMethod: opts.method, paidAt: now, updatedAt: now })
      tx.update(db.collection('r31_orders').doc(inv.orderId), { paymentStatus: 'paid', updatedAt: now })
      tx.set(notifRef, buildPaymentNotification({ userId: inv.customerId, orderId: inv.orderId, orderNumber: inv.invoiceNumber, paid: true, now }))
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}

export async function cancelInvoiceAction(idToken: string, invoiceId: string): Promise<ActionResult> {
  let _uid: string
  try { _uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status === 'paid') throw new Error('INVALID')
      tx.update(ref, { status: 'cancelled', updatedAt: Date.now() })
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}
