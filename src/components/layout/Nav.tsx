'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from './ThemeToggle'
import styles from './Nav.module.css'

const LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/#how', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
]

export function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className={styles.nav}>
      <div className={`container ${styles.inner}`}>
        <Link className={styles.brand} href="/">
          31<span>Repairs</span>
        </Link>
        <nav className={styles.links}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <ThemeToggle />
          <Button href="/login" variant="ghost">
            Sign in
          </Button>
          <Button href="/book">Book a repair</Button>
        </div>
        <button
          className={styles.burger}
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          ☰
        </button>
      </div>
      {open && (
        <div className={styles.overlay}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Sign in
          </Link>
          <Button href="/book" block onClick={() => setOpen(false)}>
            Book a repair
          </Button>
        </div>
      )}
    </header>
  )
}
