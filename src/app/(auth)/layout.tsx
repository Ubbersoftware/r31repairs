import Link from 'next/link'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import styles from './auth-layout.module.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link className={styles.brand} href="/">
          31<span>Repairs</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
