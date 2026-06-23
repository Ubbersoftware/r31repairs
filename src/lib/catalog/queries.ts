import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'
import { toService, toPhoneModel, toPriceDoc, toFaq } from './mappers'
import type { Service, PhoneModel, PriceDoc, Faq } from '@/lib/types/catalog'

export async function getActiveServices(): Promise<Service[]> {
  const snap = await getAdminDb().collection('services').where('active', '==', true).get()
  return snap.docs.map((d) => toService(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const doc = await getAdminDb().collection('services').doc(slug).get()
  if (!doc.exists) return null
  const s = toService(doc.id, doc.data() as Record<string, unknown>)
  return s.active ? s : null
}

export async function getActiveModels(): Promise<PhoneModel[]> {
  const snap = await getAdminDb().collection('phoneModels').where('active', '==', true).get()
  return snap.docs.map((d) => toPhoneModel(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getPriceMatrix(): Promise<PriceDoc[]> {
  const snap = await getAdminDb().collection('prices').get()
  return snap.docs.map((d) => toPriceDoc(d.data()))
}

export async function getActiveFaqs(): Promise<Faq[]> {
  const snap = await getAdminDb().collection('faqs').where('active', '==', true).get()
  return snap.docs.map((d) => toFaq(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getAllFaqs(): Promise<Faq[]> {
  const snap = await getAdminDb().collection('faqs').get()
  return snap.docs.map((d) => toFaq(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder)
}
