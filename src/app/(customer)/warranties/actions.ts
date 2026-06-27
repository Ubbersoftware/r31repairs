'use server'
import { revalidatePath } from 'next/cache'
import { verifyUser, getAdminDb } from '@/lib/firebase/admin'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'
import { claimRaiseSchema } from '@/lib/warranties/validation'
import { warrantyState } from '@/lib/warranties/expiry'
import { toWarranty } from '@/lib/warranties/mappers'

export async function raiseClaimAction(
  idToken: string,
  warrantyId: string,
  input: { description: string; photoURLs: string[] },
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyUser(idToken)).uid } catch (e) { return fail(e) }
  const parsed = claimRaiseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const wRef = db.collection('r31_warranties').doc(warrantyId)
  const claimRef = wRef.collection('claims').doc()
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(wRef)
      if (!snap.exists) throw new Error('INVALID')
      const warranty = toWarranty(snap.id, snap.data()!)
      if (warranty.customerId !== uid) throw new Error('FORBIDDEN')
      const now = Date.now()
      const state = warrantyState(warranty, now)
      if (state !== 'active') throw new Error('INVALID')
      tx.update(wRef, { status: 'claimed', updatedAt: now })
      tx.set(claimRef, {
        warrantyId,
        customerId: uid,
        description: parsed.data.description,
        photoURLs: parsed.data.photoURLs,
        status: 'received',
        adminNotes: null,
        createdAt: now,
        updatedAt: now,
      })
    })
  } catch (e) { return fail(e) }
  revalidatePath('/account')
  revalidatePath('/orders')
  return { ok: true }
}
