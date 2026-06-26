import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'
import type { Warranty, Claim } from '@/lib/types/warranty'
import { toWarranty, toClaim } from './mappers'

export async function getWarrantiesForAdmin(): Promise<Warranty[]> {
  const db = getAdminDb()
  const snap = await db.collection('r31_warranties').orderBy('createdAt', 'desc').get()
  return snap.docs.map((d) => toWarranty(d.id, d.data()))
}

export async function getWarrantiesForCustomer(customerId: string): Promise<Warranty[]> {
  const db = getAdminDb()
  const snap = await db.collection('r31_warranties').where('customerId', '==', customerId).get()
  return snap.docs.map((d) => toWarranty(d.id, d.data()))
}

export async function getWarranty(warrantyId: string): Promise<Warranty | null> {
  const db = getAdminDb()
  const snap = await db.collection('r31_warranties').doc(warrantyId).get()
  if (!snap.exists) return null
  return toWarranty(snap.id, snap.data()!)
}

export async function getClaimsForAdmin(): Promise<Claim[]> {
  const db = getAdminDb()
  const snap = await db.collectionGroup('claims').orderBy('createdAt', 'desc').get()
  return snap.docs.map((d) => toClaim(d.id, d.data()))
}
