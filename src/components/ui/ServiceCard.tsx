import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './ServiceCard.module.css'

export function ServiceCard({
  href,
  icon,
  title,
  desc,
  priceFrom,
}: {
  href: string
  icon?: ReactNode
  title: string
  desc: string
  priceFrom: string
}) {
  return (
    <Link href={href} className={styles.scard}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <h4 className={styles.title}>{title}</h4>
      <p className={styles.desc}>{desc}</p>
      <span className={styles.more}>{priceFrom} →</span>
    </Link>
  )
}
