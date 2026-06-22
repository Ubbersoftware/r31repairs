'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/firebase/auth'
import { ThemeToggle } from './ThemeToggle'
import styles from './AdminSidebar.module.css'

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/catalog', label: 'Catalog' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/warranties', label: 'Warranties' },
  { href: '/admin/faq', label: 'FAQ' },
  { href: '/admin/revenue', label: 'Revenue' },
  { href: '/admin/settings', label: 'Settings' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function onSignOut() {
    await logout()
    router.push('/')
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <Link className={styles.brand} href="/">
          31<span>Repairs</span>
        </Link>
        <ThemeToggle />
      </div>
      <nav className={styles.nav}>
        {LINKS.map((l) => {
          const active = pathname === l.href
          return (
            <Link key={l.href} href={l.href} className={active ? styles.active : undefined}>
              {l.label}
            </Link>
          )
        })}
      </nav>
      <button type="button" className={styles.signout} onClick={onSignOut}>
        Sign out
      </button>
    </aside>
  )
}
