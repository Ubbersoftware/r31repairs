import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { seedCatalog } from './seedCatalog'

let app: App
let db: Firestore

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  app = initializeApp({ projectId: 'demo-r31' }, 'seed-test')
  db = getFirestore(app)
})
afterAll(async () => { await deleteApp(app) })
beforeEach(async () => {
  for (const c of ['r31_services', 'r31_phoneModels', 'r31_prices', 'r31_faqs']) {
    const snap = await db.collection(c).get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
  }
})

describe('seedCatalog', () => {
  it('creates 3 services, 18 models, 72 prices, 6 faqs on first run', async () => {
    const r = await seedCatalog(db)
    expect((await db.collection('r31_services').get()).size).toBe(3)
    expect((await db.collection('r31_phoneModels').get()).size).toBe(18)
    expect((await db.collection('r31_prices').get()).size).toBe(72)
    expect((await db.collection('r31_faqs').get()).size).toBe(6)
    expect(r.created).toBe(99)
  })

  it('is idempotent and never overwrites an edited price', async () => {
    await seedCatalog(db)
    const id = 'battery__iphone-13__none'
    await db.collection('r31_prices').doc(id).update({ amount: 1 }) // owner edit
    const r2 = await seedCatalog(db)
    expect(r2.created).toBe(0)
    expect((await db.collection('r31_prices').get()).size).toBe(72) // no dupes
    expect((await db.collection('r31_prices').doc(id).get()).data()?.amount).toBe(1) // preserved
  })
})
