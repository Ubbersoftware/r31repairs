import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { seedCatalog } from '@/scripts/seedCatalog'

let app: App, db: Firestore
beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'demo-r31' })
  app = initializeApp({ projectId: 'demo-r31' }, 'queries-test')
  db = getFirestore(app)
})
afterAll(async () => { await deleteApp(app) })
beforeEach(async () => {
  for (const c of ['services', 'phoneModels', 'prices', 'faqs']) {
    const snap = await db.collection(c).get(); await Promise.all(snap.docs.map((d) => d.ref.delete()))
  }
  await seedCatalog(db)
}, 30000)

describe('queries', () => {
  it('getActiveServices returns active services in sortOrder', async () => {
    const { getActiveServices } = await import('./queries')
    const s = await getActiveServices()
    expect(s.map((x) => x.id)).toEqual(['screen', 'battery', 'back-glass'])
  }, 20000)
  it('getServiceBySlug returns one or null', async () => {
    const { getServiceBySlug } = await import('./queries')
    expect((await getServiceBySlug('battery'))?.name).toBe('Battery Replacement')
    expect(await getServiceBySlug('nope')).toBeNull()
  }, 20000)
  it('getPriceMatrix returns 72 cells', async () => {
    const { getPriceMatrix } = await import('./queries')
    expect((await getPriceMatrix()).length).toBe(72)
  }, 20000)
})
