'use client'
import { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { setServiceImageAction } from '@/app/admin/catalog/actions'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5_000_000 // 5 MB

export function ImageUploader({
  serviceId,
  current,
}: {
  serviceId: string
  current: string | null
}) {
  const [url, setUrl] = useState(current)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErr('Use a JPEG, PNG, or WebP image')
      return
    }
    if (file.size > MAX_SIZE) {
      setErr('Image must be under 5 MB')
      return
    }

    setBusy(true)
    setErr('')

    try {
      const storageRef = ref(storage, `service-images/${serviceId}`)
      const snap = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snap.ref)

      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('not signed in')

      const res = await setServiceImageAction(idToken, { id: serviceId, imageURL: downloadURL })
      if (!res.ok) throw new Error('save failed')

      setUrl(downloadURL)
    } catch {
      setErr('Upload failed — please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {url && (
        <img
          src={url}
          alt="Service image"
          style={{
            maxWidth: '100%',
            maxHeight: 160,
            objectFit: 'cover',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        />
      )}
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          cursor: busy ? 'not-allowed' : 'pointer',
          color: 'var(--text-muted)',
          fontSize: 'var(--fs-sm)',
        }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFile}
          disabled={busy}
          aria-label="Upload service image"
          style={{ minHeight: 44 }}
        />
      </label>
      {busy && (
        <span role="status" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
          Uploading…
        </span>
      )}
      {err && (
        <span role="alert" style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)' }}>
          {err}
        </span>
      )}
    </div>
  )
}
