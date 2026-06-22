'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/useAuth'
import styles from './Guard.module.css'

/**
 * UX-only gate for owner-only screens. This protects the *view*, not the data —
 * the real security boundary is the Firestore rules (role == 'owner') + custom claims.
 */
export function RequireOwner({ children }: { children: React.ReactNode }) {
  const { user, claims, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/login')
    else if (claims?.role !== 'owner') router.replace('/')
  }, [loading, user, claims, router])

  if (loading || !user || claims?.role !== 'owner') {
    return <div className={styles.gate}>Loading…</div>
  }
  return <>{children}</>
}
