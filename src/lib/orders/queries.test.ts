import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let app: App, db: Firestore
beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'demo-r31' })
  app = initializeApp({ projectId: 'demo-r31' }, 'orders-q-test'); db = getFirestore(app)
})
afterAll(async () => { await deleteApp(app) })
beforeEach(async () => {
  const snap = await db.collection('r31_orders').get()
  await Promise.all(snap.docs.map((d) => d.ref.delete()))
  await db.collection('r31_orders').doc('o1').set({ orderNumber: 'R31-0001', customerId: 'u1', status: 'placed', createdAt: 100, updatedAt: 100 })
  await db.collection('r31_orders').doc('o2').set({ orderNumber: 'R31-0002', customerId: 'u2', status: 'in_repair', createdAt: 200, updatedAt: 200 })
}, 30000)

describe('order queries', () => {
  it('getOrdersForAdmin returns newest first', async () => {
    const { getOrdersForAdmin } = await import('./queries')
    expect((await getOrdersForAdmin()).map((o) => o.id)).toEqual(['o2', 'o1'])
  }, 20000)
  it('getOrdersForAdmin filters by status', async () => {
    const { getOrdersForAdmin } = await import('./queries')
    expect((await getOrdersForAdmin({ status: 'placed' })).map((o) => o.id)).toEqual(['o1'])
  }, 20000)
  it('getOrder returns one or null', async () => {
    const { getOrder } = await import('./queries')
    expect((await getOrder('o1'))?.orderNumber).toBe('R31-0001')
    expect(await getOrder('nope')).toBeNull()
  }, 20000)
})
