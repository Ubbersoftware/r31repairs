import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './client'

export function newUserDoc(u: { uid: string; email: string | null; displayName: string | null }) {
  return {
    role: 'customer' as const,
    fullName: u.displayName ?? '',
    email: u.email ?? '',
    phone: '',
    photoURL: '',
    fcmTokens: [] as string[],
    themePref: null as null | 'dark' | 'light',
  }
}

// Create the r31_users/{uid} profile doc on first sign-in only; never clobber an existing one.
async function ensureUserDoc(user: User) {
  const ref = doc(db, 'r31_users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      ...newUserDoc(user),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}

export async function registerWithEmail(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: name })
  await ensureUserDoc(cred.user)
}

export async function loginWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password)
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, new GoogleAuthProvider())
  await ensureUserDoc(cred.user)
}

export async function logout() {
  await signOut(auth)
}
