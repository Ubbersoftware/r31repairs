'use client'
import { useState, useRef } from 'react'
import { auth } from '@/lib/firebase/client'
import { saveFaqAction, deleteFaqAction, reorderFaqAction } from '@/app/admin/faq/actions'
import type { Faq } from '@/lib/types/catalog'
import styles from './FaqEditor.module.css'

// New unsaved rows use a temporary local key (negative number as string) that is NOT sent to
// Firestore. On a successful add-save, we reload the page so the server re-reads via getAllFaqs()
// and the real Firestore id replaces the temporary one. This is the simpler approach (option a).

type LocalFaq = Faq & { _isNew?: boolean }

export function FaqEditor({ faqs: initial }: { faqs: Faq[] }) {
  const [faqs, setFaqs] = useState<LocalFaq[]>(initial)
  const [status, setStatus] = useState<Record<string, string>>({})
  const [reorderError, setReorderError] = useState(false)
  // Fix 3: temp-key counter lives in the component to avoid cross-render/test leakage
  const tempKeyRef = useRef(-1)

  function patch(id: string, p: Partial<Faq>) {
    setFaqs((list) => list.map((f) => (f.id === id ? { ...f, ...p } : f)))
  }

  async function save(f: LocalFaq) {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) {
      setStatus((s) => ({ ...s, [f.id]: 'error' }))
      return
    }
    const payload = f._isNew
      ? { question: f.question, answer: f.answer, category: f.category, active: f.active, sortOrder: f.sortOrder }
      : { id: f.id, question: f.question, answer: f.answer, category: f.category, active: f.active, sortOrder: f.sortOrder }
    const res = await saveFaqAction(idToken, payload)
    if (res.ok) {
      if (f._isNew) {
        // Reload so the server page re-reads getAllFaqs() and provides the real Firestore id
        window.location.reload()
        return
      }
      setStatus((s) => ({ ...s, [f.id]: 'saved' }))
    } else {
      setStatus((s) => ({ ...s, [f.id]: 'error' }))
    }
  }

  async function remove(id: string) {
    // Fix 2: identify new rows by _isNew flag, not the id prefix heuristic
    const target = faqs.find((f) => f.id === id)
    if (target?._isNew) {
      setFaqs((list) => list.filter((f) => f.id !== id))
      return
    }
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) return
    const res = await deleteFaqAction(idToken, id)
    if (res.ok) {
      setFaqs((list) => list.filter((f) => f.id !== id))
    }
  }

  function addNew() {
    // Fix 3: use ref-based counter instead of module-level mutable state
    const newFaq: LocalFaq = {
      id: String(tempKeyRef.current--),
      question: '',
      answer: '',
      category: 'general',
      active: true,
      sortOrder: faqs.length + 1,
      _isNew: true,
    }
    setFaqs((list) => [...list, newFaq])
  }

  async function moveUp(index: number) {
    if (index === 0) return
    // Fix 1: optimistic-with-revert pattern
    const snapshot = faqs
    const next = [...faqs]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setFaqs(next)
    const ids = next.filter((f) => !f._isNew).map((f) => f.id)
    if (ids.length === 0) return
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) {
      setFaqs(snapshot)
      setReorderError(true)
      return
    }
    const res = await reorderFaqAction(idToken, ids)
    if (!res.ok) {
      setFaqs(snapshot)
      setReorderError(true)
    } else {
      setReorderError(false)
    }
  }

  async function moveDown(index: number) {
    if (index >= faqs.length - 1) return
    // Fix 1: optimistic-with-revert pattern
    const snapshot = faqs
    const next = [...faqs]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setFaqs(next)
    const ids = next.filter((f) => !f._isNew).map((f) => f.id)
    if (ids.length === 0) return
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) {
      setFaqs(snapshot)
      setReorderError(true)
      return
    }
    const res = await reorderFaqAction(idToken, ids)
    if (!res.ok) {
      setFaqs(snapshot)
      setReorderError(true)
    } else {
      setReorderError(false)
    }
  }

  return (
    <div className={styles.list}>
      {reorderError && (
        <span role="alert" className={styles.errorMsg}>
          Could not reorder — changes reverted
        </span>
      )}
      {faqs.map((f, index) => (
        <div key={f.id} className={styles.item}>
          <div className={styles.itemHeader}>
            <span className={styles.sortLabel}>#{index + 1}</span>
            <div className={styles.reorderButtons}>
              <button
                type="button"
                onClick={() => moveUp(index)}
                disabled={index === 0}
                aria-label={`Move ${f.id} up`}
                className={styles.iconBtn}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveDown(index)}
                disabled={index >= faqs.length - 1}
                aria-label={`Move ${f.id} down`}
                className={styles.iconBtn}
              >
                ↓
              </button>
            </div>
            <label className={styles.activeLabel}>
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => patch(f.id, { active: e.target.checked })}
                aria-label={`Active ${f.id}`}
              />
              <span>Active</span>
            </label>
          </div>

          <div className={styles.fieldset}>
            <label htmlFor={`q-${f.id}`} className={styles.label}>
              Question
            </label>
            <input
              id={`q-${f.id}`}
              aria-label={`Question for ${f.id}`}
              className={styles.input}
              value={f.question}
              onChange={(e) => patch(f.id, { question: e.target.value })}
              placeholder="Enter question…"
            />
          </div>

          <div className={styles.fieldset}>
            <label htmlFor={`a-${f.id}`} className={styles.label}>
              Answer
            </label>
            <textarea
              id={`a-${f.id}`}
              aria-label={`Answer for ${f.id}`}
              className={styles.textarea}
              value={f.answer}
              onChange={(e) => patch(f.id, { answer: e.target.value })}
              rows={3}
              placeholder="Enter answer…"
            />
          </div>

          <div className={styles.fieldset}>
            <label htmlFor={`cat-${f.id}`} className={styles.label}>
              Category
            </label>
            <input
              id={`cat-${f.id}`}
              aria-label={`Category for ${f.id}`}
              className={styles.input}
              value={f.category}
              onChange={(e) => patch(f.id, { category: e.target.value })}
              placeholder="general"
            />
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={() => save(f)}
              aria-label={`Save ${f.id}`}
              className={styles.saveBtn}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => remove(f.id)}
              aria-label={`Delete ${f.id}`}
              className={styles.deleteBtn}
            >
              Delete
            </button>
            {status[f.id] === 'saved' && (
              <span role="status" className={styles.savedMsg}>
                Saved
              </span>
            )}
            {status[f.id] === 'error' && (
              <span role="alert" className={styles.errorMsg}>
                Could not save
              </span>
            )}
          </div>
        </div>
      ))}

      <div className={styles.addRow}>
        <button type="button" onClick={addNew} aria-label="Add new FAQ" className={styles.addBtn}>
          + Add FAQ
        </button>
      </div>
    </div>
  )
}
