// src/app/admin/orders/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { statusChangeSchema, lineEditSchema, noteSchema } from '@/lib/orders/validation'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'
import type { OrderStatus } from '@/lib/types/order'
import { buildStatusNotification, buildPriceNotification } from '@/lib/notifications/buildNotification'
import { orderToWarrantyDrafts } from '@/lib/warranties/mappers'
import { WARRANTY_MONTHS } from '@/lib/warranties/expiry'
import type { Order } from '@/lib/types/order'

function revalidateOrder(orderId: string) {
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/account')
}

async function applyStatus(
  uid: string,
  orderId: string,
  toStatus: OrderStatus,
  note: string | undefined,
): Promise<ActionResult> {
  const db = getAdminDb()
  const ref = db.collection('r31_orders').doc(orderId)
  const eventRef = ref.collection('events').doc()
  const notifRef = db.collection('r31_notifications').doc()
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error('INVALID')
    const order = snap.data()!
    const fromStatus = order.status as OrderStatus
    const now = Date.now()
    tx.update(ref, { status: toStatus, updatedAt: now })
    tx.set(eventRef, {
      type: 'status_change',
      fromStatus,
      toStatus,
      note: note ?? null,
      visibility: 'customer',
      byUserId: uid,
      byRole: 'owner',
      at: now,
    })
    tx.set(notifRef, buildStatusNotification({
      userId: order.customerId as string,
      orderId,
      orderNumber: order.orderNumber as string,
      toStatus,
      now,
    }))
  })
  revalidateOrder(orderId)
  return { ok: true }
}

export async function changeOrderStatusAction(
  idToken: string,
  orderId: string,
  toStatus: string,
  note?: string,
): Promise<ActionResult> {
  let uid: string
  try {
    uid = (await verifyOwner(idToken)).uid
  } catch (e) {
    return fail(e)
  }
  const parsed = statusChangeSchema.safeParse({ toStatus, note })
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  try {
    return await applyStatus(uid, orderId, parsed.data.toStatus, parsed.data.note)
  } catch (e) {
    return fail(e)
  }
}

export async function cancelOrderAction(
  idToken: string,
  orderId: string,
  note?: string,
): Promise<ActionResult> {
  let uid: string
  try {
    uid = (await verifyOwner(idToken)).uid
  } catch (e) {
    return fail(e)
  }
  try {
    return await applyStatus(uid, orderId, 'cancelled', note)
  } catch (e) {
    return fail(e)
  }
}

export async function editLineAction(
  idToken: string,
  orderId: string,
  edit: { itemId: string; finalAmount: number; note?: string },
): Promise<ActionResult> {
  let uid: string
  try {
    uid = (await verifyOwner(idToken)).uid
  } catch (e) {
    return fail(e)
  }
  const parsed = lineEditSchema.safeParse(edit)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const ref = db.collection('r31_orders').doc(orderId)
  const eventRef = ref.collection('events').doc()
  const notifRef = db.collection('r31_notifications').doc()
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const order = snap.data()!
      const items = (order.items as { itemId: string; quotedAmount: number; finalAmount?: number }[]) ?? []
      const next = items.map((it) =>
        it.itemId === parsed.data.itemId ? { ...it, finalAmount: parsed.data.finalAmount } : it,
      )
      const finalTotal = next.reduce((sum, it) => sum + (it.finalAmount ?? it.quotedAmount), 0)
      const now = Date.now()
      tx.update(ref, { items: next, finalTotal, updatedAt: now })
      tx.set(eventRef, {
        type: 'line_edit',
        note: parsed.data.note ?? 'Price updated',
        visibility: 'customer',
        byUserId: uid,
        byRole: 'owner',
        at: now,
      })
      tx.set(notifRef, buildPriceNotification({
        userId: order.customerId as string,
        orderId,
        orderNumber: order.orderNumber as string,
        now,
      }))
    })
  } catch (e) {
    return fail(e)
  }
  revalidateOrder(orderId)
  return { ok: true }
}

export async function completeCollectionAction(
  idToken: string,
  orderId: string,
  signatureURL: string,
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  if (!signatureURL) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const ref = db.collection('r31_orders').doc(orderId)
  const eventRef = ref.collection('events').doc()
  const notifRef = db.collection('r31_notifications').doc()
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const order = snap.data()! as Order
      if (order.status !== 'ready') throw new Error('INVALID')
      const now = Date.now()
      tx.update(ref, { status: 'completed', signatureURL, signedAt: now, completedAt: now, updatedAt: now })
      tx.set(eventRef, {
        type: 'status_change', fromStatus: 'ready', toStatus: 'completed',
        note: 'Collected & signed', visibility: 'customer', byUserId: uid, byRole: 'owner', at: now,
      })
      tx.set(notifRef, buildStatusNotification({
        userId: order.customerId, orderId,
        orderNumber: order.orderNumber, toStatus: 'completed', now,
      }))
      const drafts = orderToWarrantyDrafts(order, WARRANTY_MONTHS, now)
      for (const draft of drafts) {
        tx.set(db.collection('r31_warranties').doc(), draft)
      }
    })
  } catch (e) { return fail(e) }
  revalidateOrder(orderId)
  return { ok: true }
}

export async function addOrderNoteAction(
  idToken: string,
  orderId: string,
  note: string,
  visibility: 'customer' | 'internal',
): Promise<ActionResult> {
  let uid: string
  try {
    uid = (await verifyOwner(idToken)).uid
  } catch (e) {
    return fail(e)
  }
  const parsed = noteSchema.safeParse({ note })
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const ref = getAdminDb().collection('r31_orders').doc(orderId)
  try {
    await ref.collection('events').doc().set({
      type: 'note',
      note: parsed.data.note,
      visibility: visibility === 'customer' ? 'customer' : 'internal',
      byUserId: uid,
      byRole: 'owner',
      at: Date.now(),
    })
    revalidateOrder(orderId)
  } catch (e) {
    return fail(e)
  }
  return { ok: true }
}
