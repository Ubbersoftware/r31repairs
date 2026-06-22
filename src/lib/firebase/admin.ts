import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app'
import 'server-only'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth'

export function getAdminApp(): App {
  // Return the default app if it already exists (getApp() throws when no default app).
  if (getApps().length) {
    try { return getApp() } catch { /* only named apps exist — fall through to init default */ }
  }
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
  if (!sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing or invalid')
  // When running against the Firestore emulator, credentials are not required.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: sa.project_id })
  }
  return initializeApp({ credential: cert(sa) })
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp())
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}

export async function verifyOwner(idToken: string): Promise<DecodedIdToken> {
  if (!idToken) throw new Error('UNAUTHENTICATED')
  let decoded: DecodedIdToken
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken)
  } catch {
    throw new Error('UNAUTHENTICATED')
  }
  if (decoded.role !== 'owner') throw new Error('FORBIDDEN')
  return decoded
}
