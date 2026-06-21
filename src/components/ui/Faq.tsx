import styles from './Faq.module.css'

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className={styles.faq}>
      {items.map((it, i) => (
        <details key={i} className={styles.item}>
          <summary className={styles.q}>{it.q}</summary>
          <div className={styles.a}>
            <p>{it.a}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
