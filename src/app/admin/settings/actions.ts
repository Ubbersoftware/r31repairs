'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'
import { settingsInputSchema } from '@/lib/settings/validation'

export async function updateSettingsAction(
  idToken: string,
  input: unknown,
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = settingsInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  try {
    await getAdminDb()
      .collection('r31_settings')
      .doc('shop')
      .set({ ...parsed.data, updatedAt: Date.now(), updatedBy: uid }, { merge: true })
  } catch (e) { return fail(e) }
  revalidatePath('/')
  revalidatePath('/admin/settings')
  revalidatePath('/orders')
  return { ok: true }
}
