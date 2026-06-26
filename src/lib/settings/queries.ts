import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'
import type { ShopSettings } from '@/lib/types/settings'
import { mergeSettings } from './defaults'

export async function getSettings(): Promise<ShopSettings> {
  const db = getAdminDb()
  const snap = await db.collection('r31_settings').doc('shop').get()
  return mergeSettings(snap.exists ? (snap.data() as Partial<ShopSettings>) : null)
}

export async function getOwners(): Promise<{ uid: string; name: string; email: string }[]> {
  const db = getAdminDb()
  const snap = await db.collection('r31_users').where('role', '==', 'owner').get()
  return snap.docs.map((d) => ({
    uid: d.id,
    name: (d.data().displayName as string) ?? '',
    email: (d.data().email as string) ?? '',
  }))
}
