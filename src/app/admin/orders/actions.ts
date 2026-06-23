// src/app/admin/orders/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { statusChangeSchema } from '@/lib/orders/validation'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'
import type { OrderStatus } from '@/lib/types/order'

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
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error('INVALID')
    const fromStatus = snap.data()!.status as OrderStatus
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
    return await applyStatus(uid, orderId, parsed.data.toStatus as OrderStatus, parsed.data.note)
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
