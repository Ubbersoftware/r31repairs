import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app'
import 'server-only'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth'

export function getAdminApp(): App {
  if (getApps().length) return getApp()
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
  if (!sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing or invalid')
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
