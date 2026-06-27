'use client'
import { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { raiseClaimAction } from '@/app/(customer)/warranties/actions'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export function ClaimForm({ warrantyId, onDone }: { warrantyId: string; onDone: () => void }) {
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('not signed in')
      const photoURLs = await Promise.all(
        files.map(async (file) => {
          const path = `r31/warranty-claims/${warrantyId}/${Date.now()}-${file.name}`
          const snap = await uploadBytes(ref(storage, path), file)
          return getDownloadURL(snap.ref)
        }),
      )
      const res = await raiseClaimAction(idToken, warrantyId, { description, photoURLs })
      if (!res.ok) throw new Error(res.error ?? 'failed')
      onDone()
    } catch { setErr('Failed to submit — please try again') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <label>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Describe the issue</span>
        <textarea
          aria-label="Describe the issue"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          required
          rows={3}
          style={{ minHeight: 80 }}
        />
      </label>
      <label>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Photos (optional, up to 6)</span>
        <input
          aria-label="Photos"
          type="file"
          accept={ALLOWED.join(',')}
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
          style={{ minHeight: 44 }}
        />
      </label>
      <button type="submit" disabled={busy || !description.trim()} style={{ minHeight: 44 }}>
        {busy ? 'Submitting…' : 'Submit claim'}
      </button>
      {err && <span role="alert" style={{ color: 'var(--danger)' }}>{err}</span>}
    </form>
  )
}
