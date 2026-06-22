import { describe, it, expect, vi } from 'vitest'

vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'test-key')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'lmsb2b')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'lmsb2b.firebaseapp.com')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'lmsb2b.firebasestorage.app')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '387302091297')
vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'app-id')

describe('firebase config', () => {
  it('reads projectId from env', async () => {
    const { firebaseConfig } = await import('./client')
    expect(firebaseConfig.projectId).toBe('lmsb2b')
  })
})
