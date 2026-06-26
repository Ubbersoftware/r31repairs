'use client'
import { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { submitProofOfPaymentAction } from '@/app/(customer)/orders/actions'
import { PAYMENT_CHANNELS, type PaymentMethod } from '@/lib/invoices/paymentMethods'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX = 5_000_000

export function ProofUploader({ orderId, invoiceId, onDone }: { orderId: string; invoiceId: string; onDone: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const channel = PAYMENT_CHANNELS.find((c) => c.id === method)!

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED.includes(file.type)) { setErr('Use a JPEG, PNG, or WebP image'); return }
    if (file.size > MAX) { setErr('Image must be under 5 MB'); return }
    setBusy(true); setErr('')
    try {
      const path = `r31/proof-of-payment/${orderId}/${Date.now()}-${file.name}`
      const snap = await uploadBytes(ref(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('not signed in')
      const res = await submitProofOfPaymentAction(idToken, invoiceId, method, url)
      if (!res.ok) throw new Error('save failed')
      onDone()
    } catch { setErr('Upload failed — please try again') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <label>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Payment method</span>
        <select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} style={{ minHeight: 44 }}>
          {PAYMENT_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{channel.payToLabel}: {channel.details}</p>
      <input aria-label="Upload proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={busy} style={{ minHeight: 44 }} />
      {busy && <span role="status">Uploading…</span>}
      {err && <span role="alert" style={{ color: 'var(--danger)' }}>{err}</span>}
    </div>
  )
}
