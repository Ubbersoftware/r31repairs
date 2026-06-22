import styles from './page.module.css'

const CARDS = [
  { title: 'Open jobs', desc: 'Repairs currently in the pipeline.' },
  { title: "Today's collections", desc: 'Jobs ready for pickup today.' },
  { title: 'Unverified payments', desc: 'Proof-of-payment awaiting your review.' },
]

export default function AdminOverviewPage() {
  return (
    <>
      <p className="overline">Admin</p>
      <h1>Overview</h1>
      <p className={styles.intro}>Your shop at a glance. Live numbers arrive in Phase 1.</p>
      <div className={styles.grid}>
        {CARDS.map((c) => (
          <div key={c.title} className={styles.card}>
            <h3>{c.title}</h3>
            <p className={styles.desc}>{c.desc}</p>
            <span className={styles.soon}>Coming in Phase 1</span>
          </div>
        ))}
      </div>
    </>
  )
}
