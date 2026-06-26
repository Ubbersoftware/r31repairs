'use client'
import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase/client'
import { mergeSettings } from '@/lib/settings/defaults'
import type { ShopSettings } from '@/lib/types/settings'
import type { PaymentChannel } from '@/lib/invoices/paymentMethods'
import { updateSettingsAction } from './actions'
import styles from './settings.module.css'

interface Owner { uid: string; name: string; email: string }

export function SettingsForm() {
  const [settings, setSettings] = useState<ShopSettings>(mergeSettings(null))
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    void (async () => {
      const [settingsSnap, usersSnap] = await Promise.all([
        getDoc(doc(db, 'r31_settings', 'shop')),
        // query owners client-side (admin has read access to r31_users)
        import('firebase/firestore').then(({ collection, getDocs, query, where }) =>
          getDocs(query(collection(db, 'r31_users'), where('role', '==', 'owner')))
        ),
      ])
      setSettings(mergeSettings(settingsSnap.exists() ? settingsSnap.data() as Partial<ShopSettings> : null))
      setOwners(usersSnap.docs.map((d) => ({ uid: d.id, name: d.data().displayName ?? '', email: d.data().email ?? '' })))
      setLoading(false)
    })()
  }, [])

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const path = `r31/branding/logo-${Date.now()}.${file.name.split('.').pop()}`
      const snap = await uploadBytes(ref(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      setSettings((s) => ({ ...s, logoURL: url }))
    } finally { setLogoUploading(false) }
  }

  function updateChannel(idx: number, field: keyof PaymentChannel, value: string) {
    setSettings((s) => {
      const channels = [...s.paymentChannels]
      channels[idx] = { ...channels[idx], [field]: value }
      return { ...s, paymentChannels: channels }
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('not signed in')
      const res = await updateSettingsAction(idToken, settings)
      setMsg(res.ok ? { ok: true, text: 'Settings saved' } : { ok: false, text: res.error ?? 'Save failed' })
    } catch { setMsg({ ok: false, text: 'Save failed — please try again' }) } finally { setBusy(false) }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading settings…</p>

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {/* Shop profile */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Shop profile</h2>
        {(
          [
            { key: 'name', label: 'Name' },
            { key: 'address', label: 'Address' },
            { key: 'mapURL', label: 'Google Maps URL' },
            { key: 'phone', label: 'Phone' },
            { key: 'instagram', label: 'Instagram handle' },
          ] as { key: keyof ShopSettings; label: string }[]
        ).map(({ key, label }) => (
          <div key={key} className={styles.fieldGroup}>
            <label className={styles.label} htmlFor={key}>{label}</label>
            <input
              id={key}
              type="text"
              value={(settings[key] as string) ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
              style={{ minHeight: 44 }}
            />
          </div>
        ))}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Logo</label>
          {settings.logoURL && (
            <img src={settings.logoURL} alt="Logo" style={{ height: 48, objectFit: 'contain', marginBottom: 'var(--space-2)' }} />
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo} disabled={logoUploading} style={{ minHeight: 44 }} />
          {logoUploading && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Uploading…</span>}
        </div>
      </div>

      {/* Payment channels */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Payment channels</h2>
        {settings.paymentChannels.map((ch, idx) => (
          <div key={ch.id} className={styles.channel}>
            <div className={styles.channelHeader}>
              <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{ch.label}</span>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor={`ch-payToLabel-${idx}`}>Pay-to label</label>
              <input id={`ch-payToLabel-${idx}`} type="text" value={ch.payToLabel} onChange={(e) => updateChannel(idx, 'payToLabel', e.target.value)} style={{ minHeight: 44 }} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor={`ch-details-${idx}`}>Details (account number / merchant)</label>
              <input id={`ch-details-${idx}`} type="text" value={ch.details} onChange={(e) => updateChannel(idx, 'details', e.target.value)} style={{ minHeight: 44 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Warranty period */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Warranty</h2>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="warrantyMonths">Warranty period (months)</label>
          <input
            id="warrantyMonths"
            type="number"
            min={1}
            max={24}
            value={settings.warrantyMonths}
            onChange={(e) => setSettings((s) => ({ ...s, warrantyMonths: Number(e.target.value) }))}
            style={{ minHeight: 44, maxWidth: 120 }}
          />
        </div>
      </div>

      {/* Owners list (read-only) */}
      {owners.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Owners (read-only)</h2>
          <ul className={styles.ownersList}>
            {owners.map((o) => (
              <li key={o.uid} className={styles.ownerItem}>
                <span>{o.name || '(no name)'}</span>
                <span>{o.email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.actions}>
        <button type="submit" disabled={busy} style={{ minHeight: 44 }}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
        {msg && (
          <span className={msg.ok ? styles.success : styles.error}>{msg.text}</span>
        )}
      </div>
    </form>
  )
}
