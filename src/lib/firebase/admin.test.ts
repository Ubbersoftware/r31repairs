import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Avoid real network: mock firebase-admin modules.
vi.mock('firebase-admin/app', () => {
  const apps: unknown[] = []
  return {
    getApps: () => apps,
    getApp: () => apps[0],
    initializeApp: (opts: unknown) => { const a = { opts }; apps.push(a); return a },
    cert: (sa: unknown) => ({ sa }),
  }
})
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ kind: 'db' }) }))
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: async (t: string) =>
      t === 'owner-token' ? { uid: 'u1', role: 'owner' }
      : t === 'customer-token' ? { uid: 'u2', role: 'customer' }
      : Promise.reject(new Error('bad token')),
  }),
}))

beforeEach(() => { process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'demo-r31' }) })

describe('admin', () => {
  it('verifyOwner resolves for an owner token', async () => {
    const { verifyOwner } = await import('./admin')
    await expect(verifyOwner('owner-token')).resolves.toMatchObject({ role: 'owner' })
  })
  it('verifyOwner rejects a customer token with FORBIDDEN', async () => {
    const { verifyOwner } = await import('./admin')
    await expect(verifyOwner('customer-token')).rejects.toThrow('FORBIDDEN')
  })
  it('verifyOwner rejects a missing token with UNAUTHENTICATED', async () => {
    const { verifyOwner } = await import('./admin')
    await expect(verifyOwner('')).rejects.toThrow('UNAUTHENTICATED')
  })
})

describe('getAdminApp() emulator production guard', () => {
  afterEach(() => {
    // Restore env vars so other tests are unaffected.
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('throws when FIRESTORE_EMULATOR_HOST is set in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', 'localhost:8080')
    // Re-register mocks with a fresh apps array so the singleton hasn't been
    // initialised yet, ensuring getAdminApp() reaches the emulator branch.
    vi.resetModules()
    vi.doMock('firebase-admin/app', () => {
      const apps: unknown[] = []
      return {
        getApps: () => apps,
        getApp: () => apps[0],
        initializeApp: (opts: unknown) => { const a = { opts }; apps.push(a); return a },
        cert: (sa: unknown) => ({ sa }),
      }
    })
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => ({ kind: 'db' }) }))
    vi.doMock('firebase-admin/auth', () => ({ getAuth: () => ({}) }))
    vi.doMock('server-only', () => ({}))
    const { getAdminDb } = await import('./admin')
    expect(() => getAdminDb()).toThrow('FIRESTORE_EMULATOR_HOST must not be set in production')
  })
})
