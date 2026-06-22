import { describe, it, expect, vi } from 'vitest'

// auth.ts imports ./client, which initializes Firebase at load (getAuth needs a
// valid-looking apiKey). Stub the web config so the import does not throw.
vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'test-key')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'lmsb2b')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'lmsb2b.firebaseapp.com')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'lmsb2b.firebasestorage.app')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '387302091297')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'app-id')

const { newUserDoc } = await import('./auth')

describe('newUserDoc', () => {
  it('defaults the role to customer and carries profile fields', () => {
    const doc = newUserDoc({ uid: 'u1', email: 'a@b.com', displayName: 'Thabo' })
    expect(doc.role).toBe('customer')
    expect(doc.email).toBe('a@b.com')
    expect(doc.fullName).toBe('Thabo')
    expect(doc.fcmTokens).toEqual([])
  })
})
