'use client'
import { useAuth } from '@/lib/auth/useAuth'
import styles from './account.module.css'

const SECTIONS = [
  { title: 'My orders', desc: 'Track repairs from received to ready for collection.' },
  { title: 'Invoices', desc: 'View invoices, pay, and upload proof of payment.' },
  { title: 'Warranties', desc: 'See active warranties and raise a claim.' },
]

export default function AccountPage() {
  const { user } = useAuth()
  const firstName = (user?.displayName ?? '').split(' ')[0]

  return (
    <section className="section">
      <div className="container">
        <p className="overline">Your account</p>
        <h1>{firstName ? `Hi, ${firstName}` : 'Welcome'}</h1>
        <p className={styles.intro}>
          This is your 31Repairs hub. Orders, invoices and warranties land here soon.
        </p>
        <div className={styles.grid}>
          {SECTIONS.map((s) => (
            <div key={s.title} className={styles.card}>
              <h3>{s.title}</h3>
              <p className={styles.desc}>{s.desc}</p>
              <span className={styles.soon}>Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
