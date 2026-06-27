'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import styles from './page.module.css'

interface Card {
  title: string
  desc: string
  count: number | null
  href: string
  alert: boolean
}

export function OverviewDashboard() {
  const [openJobs, setOpenJobs] = useState<number | null>(null)
  const [collections, setCollections] = useState<number | null>(null)
  const [unverified, setUnverified] = useState<number | null>(null)

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(db, 'r31_orders'), where('status', 'not-in', ['completed', 'cancelled'])),
        (snap) => setOpenJobs(snap.size),
        () => setOpenJobs(0),
      ),
      onSnapshot(
        query(collection(db, 'r31_orders'), where('status', '==', 'ready')),
        (snap) => setCollections(snap.size),
        () => setCollections(0),
      ),
      onSnapshot(
        query(collection(db, 'r31_invoices'), where('status', '==', 'payment_submitted')),
        (snap) => setUnverified(snap.size),
        () => setUnverified(0),
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  const cards: Card[] = [
    {
      title: 'Open jobs',
      desc: 'Repairs currently in the pipeline.',
      count: openJobs,
      href: '/admin/orders',
      alert: false,
    },
    {
      title: "Today's collections",
      desc: 'Jobs ready for pickup today.',
      count: collections,
      href: '/admin/orders',
      alert: (collections ?? 0) > 0,
    },
    {
      title: 'Unverified payments',
      desc: 'Proof-of-payment awaiting your review.',
      count: unverified,
      href: '/admin/invoices',
      alert: (unverified ?? 0) > 0,
    },
  ]

  return (
    <div className={styles.grid}>
      {cards.map((c) => (
        <Link key={c.title} href={c.href} className={`${styles.card} ${c.alert ? styles.cardAlert : ''}`}>
          <div className={styles.count}>
            {c.count === null ? '—' : c.count}
          </div>
          <h3 className={styles.cardTitle}>{c.title}</h3>
          <p className={styles.desc}>{c.desc}</p>
        </Link>
      ))}
    </div>
  )
}
