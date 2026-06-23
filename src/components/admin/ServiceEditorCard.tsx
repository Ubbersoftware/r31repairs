'use client'
import { useState } from 'react'
import { auth } from '@/lib/firebase/client'
import { saveServiceAction } from '@/app/admin/catalog/actions'
import { ImageUploader } from './ImageUploader'
import { Button } from '@/components/ui/Button'
import type { Service } from '@/lib/types/catalog'
import styles from './ServiceEditorCard.module.css'

export function ServiceEditorCard({ service }: { service: Service }) {
  const [description, setDescription] = useState(service.description)
  const [active, setActive] = useState(service.active)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save() {
    setStatus('saving')
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) {
      setStatus('error')
      return
    }
    const res = await saveServiceAction(idToken, { id: service.id, description, active })
    if (res.ok) {
      setStatus('saved')
    } else {
      setStatus('error')
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.name}>{service.name}</h3>
        <label className={styles.activeLabel}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked)
              setStatus('idle')
            }}
            aria-label={`${service.name} active`}
          />
          <span>Active</span>
        </label>
      </div>

      <div className={styles.fieldset}>
        <label htmlFor={`desc-${service.id}`} className={styles.label}>
          Description
        </label>
        <textarea
          id={`desc-${service.id}`}
          className={styles.textarea}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            setStatus('idle')
          }}
          rows={4}
          placeholder="Describe this service for customers…"
        />
      </div>

      <div className={styles.footer}>
        <Button
          type="button"
          onClick={save}
          disabled={status === 'saving'}
          variant="primary"
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </Button>
        {status === 'saved' && (
          <span role="status" className={styles.savedMsg}>
            Saved
          </span>
        )}
        {status === 'error' && (
          <span role="alert" className={styles.errorMsg}>
            Could not save — check that you are signed in as an owner.
          </span>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.imageSection}>
        <span className={styles.sectionLabel}>Service image</span>
        <ImageUploader serviceId={service.id} current={service.imageURL} />
      </div>
    </div>
  )
}
