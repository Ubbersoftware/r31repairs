// src/app/admin/warranties/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'
import { claimUpdateSchema } from '@/lib/warranties/validation'
import { buildClaimNotification } from '@/lib/notifications/buildNotification'

export async function updateClaimAction(
  idToken: string,
  warrantyId: string,
  claimId: string,
  input: { status: string; adminNotes: string | null },
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = claimUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const claimRef = db.collection('r31_warranties').doc(warrantyId).collection('claims').doc(claimId)
  const notifRef = db.collection('r31_notifications').doc()
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(claimRef)
      if (!snap.exists) throw new Error('INVALID')
      const claim = snap.data()!
      const now = Date.now()
      tx.update(claimRef, { status: parsed.data.status, adminNotes: parsed.data.adminNotes, updatedAt: now })
      tx.set(notifRef, buildClaimNotification({
        userId: claim.customerId as string,
        warrantyId,
        status: parsed.data.status,
        now,
      }))
    })
  } catch (e) { return fail(e) }
  revalidatePath('/admin/warranties')
  revalidatePath('/account')
  return { ok: true }
}
