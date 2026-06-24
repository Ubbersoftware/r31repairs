'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/lib/auth/useAuth'
import type { Notification } from '@/lib/types/notification'
import styles from './NotificationBell.module.css'

export function NotificationBell() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const uid = user?.uid ?? null

  // Subscribe to r31_notifications for the current user
  useEffect(() => {
    if (loading || !uid) return

    const q = query(
      collection(db, 'r31_notifications'),
      where('userId', '==', uid),
    )

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Notification),
      )
      // Sort newest first, cap at 20
      docs.sort((a, b) => b.createdAt - a.createdAt)
      setItems(docs.slice(0, 20))
    })

    return () => unsub()
  }, [uid, loading])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Don't render until auth is resolved and user is signed in
  if (loading || !uid) return null

  const unread = items.filter((n) => !n.read).length

  function handleItemClick(n: Notification) {
    // Fire-and-forget the mark-read; navigate immediately so the test
    // (and production UX) sees both updateDoc called AND router.push called.
    void updateDoc(doc(db, 'r31_notifications', n.id), { read: true })
    router.push(n.link)
  }

  async function markAllRead() {
    await Promise.all(
      items
        .filter((n) => !n.read)
        .map((n) => updateDoc(doc(db, 'r31_notifications', n.id), { read: true })),
    )
  }

  function relativeTime(createdAt: number): string {
    const diff = Date.now() - createdAt
    const minutes = Math.floor(diff / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className={styles.root} ref={dropdownRef}>
      <button
        type="button"
        className={styles.bell}
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => setOpen((prev) => !prev)}
      >
        {/* Bell SVG icon */}
        <svg
          aria-hidden="true"
          focusable="false"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown} role="dialog" aria-label="Notifications">
          <div className={styles.header}>
            <span className={styles.headerTitle}>Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                className={styles.markAll}
                onClick={markAllRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <ul className={styles.list}>
            {items.length === 0 ? (
              <li className={styles.empty}>No notifications yet.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${!n.read ? styles.itemUnread : ''}`}
                    onClick={() => handleItemClick(n)}
                  >
                    {!n.read && <span className={styles.dot} aria-hidden="true" />}
                    <div className={styles.itemBody}>
                      <p className={styles.itemTitle}>{n.title}</p>
                      <p className={styles.itemText}>{n.body}</p>
                      <time className={styles.itemTime}>
                        {relativeTime(n.createdAt)}
                      </time>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
