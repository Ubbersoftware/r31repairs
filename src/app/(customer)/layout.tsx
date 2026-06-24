'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { RequireUser } from '@/components/auth/RequireUser'
import { Button } from '@/components/ui/Button'
import { logout } from '@/lib/firebase/auth'
import styles from './customer-layout.module.css'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  async function onSignOut() {
    await logout()
    router.push('/')
  }

  return (
    <RequireUser>
      <div className={styles.shell}>
        <header className={styles.bar}>
          <div className={`container ${styles.inner}`}>
            <Link className={styles.brand} href="/">
              31<span>Repairs</span>
            </Link>
            <nav className={styles.navLinks}>
              <Link href="/account">My account</Link>
              <Link href="/book">Book a repair</Link>
            </nav>
            <div className={styles.actions}>
              <ThemeToggle />
              <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </RequireUser>
  )
}
