// src/app/admin/invoices/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { nextInvoiceNumber } from '@/lib/invoices/invoiceNumber'
import { orderItemsToLineItems } from '@/lib/invoices/mappers'
import { computeTotals } from '@/lib/invoices/totals'
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
