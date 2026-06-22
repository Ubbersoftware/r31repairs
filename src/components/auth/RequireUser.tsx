'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/useAuth'
import styles from './Guard.module.css'

/**
 * UX-only gate for any signed-in area. Redirects guests to /login. Data access
 * is still enforced by Firestore rules; this just keeps the view tidy.
 */
export function RequireUser({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user) {
    return <div className={styles.gate}>Loading…</div>
  }
  return <>{children}</>
}
