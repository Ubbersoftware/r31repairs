'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import { createOrderAction } from '@/app/(customer)/orders/actions'
import { priceFor } from '@/lib/catalog/pricing'
import { formatPula } from '@/lib/money'
import type { Service, PhoneModel, PriceDoc } from '@/lib/types/catalog'
import styles from './BookingBuilder.module.css'

interface Props {
  services: Service[]
  models: PhoneModel[]
  matrix: PriceDoc[]
}

interface ServiceRow {
  itemId: string
  serviceId: string
  variant: string | null
}

interface DeviceCard {
  deviceId: string
  phoneModelId: string
  label: string
  notes: string
  items: ServiceRow[]
}

type Phase = 'build' | 'review' | 'success'

export function BookingBuilder({ services, models, matrix }: Props) {
  const router = useRouter()
  const counter = useRef(0)
  const nextId = () => `local-${++counter.current}`

  const [devices, setDevices] = useState<DeviceCard[]>([])
  const [phase, setPhase] = useState<Phase>('build')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Compute estimated total in thebe
  const totalThebe = devices.reduce((sum, device) => {
    return sum + device.items.reduce((s, row) => {
      if (!row.serviceId || !device.phoneModelId) return s
      const price = priceFor(matrix, row.serviceId, device.phoneModelId, row.variant)
      return s + (price ?? 0)
    }, 0)
  }, 0)

  function addDevice() {
    setDevices(prev => [
      ...prev,
      { deviceId: nextId(), phoneModelId: '', label: '', notes: '', items: [] },
    ])
  }

  function removeDevice(deviceId: string) {
    setDevices(prev => prev.filter(d => d.deviceId !== deviceId))
  }

  function updateDevice(deviceId: string, patch: Partial<Omit<DeviceCard, 'deviceId' | 'items'>>) {
    setDevices(prev => prev.map(d => d.deviceId === deviceId ? { ...d, ...patch } : d))
  }

  function addServiceRow(deviceId: string) {
    setDevices(prev => prev.map(d =>
      d.deviceId === deviceId
        ? { ...d, items: [...d.items, { itemId: nextId(), serviceId: '', variant: null }] }
        : d,
    ))
  }

  function removeServiceRow(deviceId: string, itemId: string) {
    setDevices(prev => prev.map(d =>
      d.deviceId === deviceId
        ? { ...d, items: d.items.filter(it => it.itemId !== itemId) }
        : d,
    ))
  }

  function updateServiceRow(deviceId: string, itemId: string, patch: Partial<Omit<ServiceRow, 'itemId'>>) {
    setDevices(prev => prev.map(d =>
      d.deviceId === deviceId
        ? {
            ...d,
            items: d.items.map(it =>
              it.itemId === itemId ? { ...it, ...patch } : it,
            ),
          }
        : d,
    ))
  }

  async function handleConfirm() {
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        setErrorMsg('Not signed in. Please refresh and try again.')
        setSubmitting(false)
        return
      }

      const result = await createOrderAction(idToken, {
        devices: devices.map(d => ({
          deviceId: d.deviceId,
          phoneModelId: d.phoneModelId,
          label: d.label || undefined,
          notes: d.notes || undefined,
          items: d.items.map(it => ({
            itemId: it.itemId,
            serviceId: it.serviceId,
            variant: it.variant,
          })),
        })),
      })

      if (result.ok) {
        setPhase('success')
        router.push(`/orders/${result.orderId}`)
      } else {
        setErrorMsg(result.message ?? result.error ?? 'Something went wrong.')
      }
    } catch {
      setErrorMsg('An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'success') {
    return (
      <div className={styles.successBox}>
        <p className={styles.successMsg}>Booking confirmed! Redirecting to your order…</p>
      </div>
    )
  }

  if (phase === 'review') {
    return (
      <div className={styles.builder}>
        <h2 className={styles.reviewHeading}>Review your booking</h2>
        <ul className={styles.reviewList}>
          {devices.map(d => {
            const model = models.find(m => m.id === d.phoneModelId)
            return (
              <li key={d.deviceId} className={styles.reviewDevice}>
                <strong>{model?.name ?? 'Unknown device'}</strong>
                {d.label && <span className={styles.reviewLabel}> — {d.label}</span>}
                <ul className={styles.reviewItems}>
                  {d.items.map(it => {
                    const svc = services.find(s => s.id === it.serviceId)
                    const price = priceFor(matrix, it.serviceId, d.phoneModelId, it.variant)
                    return (
                      <li key={it.itemId} className={styles.reviewItem}>
                        {svc?.name ?? it.serviceId}
                        {it.variant && ` (${it.variant})`}
                        {price != null && (
                          <span className={styles.linePrice}>{formatPula(price)}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>

        {totalThebe > 0 && (
          <p className={styles.totalLine}>
            Estimated total: <strong>{formatPula(totalThebe)}</strong>
          </p>
        )}

        {errorMsg && (
          <p role="alert" className={styles.errorAlert}>{errorMsg}</p>
        )}

        <div className={styles.reviewActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setPhase('build')}
            disabled={submitting}
          >
            Back
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      </div>
    )
  }

  // Build phase
  function isRowComplete(row: ServiceRow): boolean {
    if (!row.serviceId) return false
    const svc = services.find(s => s.id === row.serviceId)
    if (svc?.hasVariants && svc.variants.length > 0) return row.variant !== null
    return true
  }

  const canReview = devices.length > 0 && devices.every(
    d => d.phoneModelId && d.items.length > 0 && d.items.every(isRowComplete),
  )

  return (
    <div className={styles.builder}>
      {devices.length === 0 && (
        <p className={styles.emptyHint}>Add a device to get started.</p>
      )}

      {devices.map((device, di) => {
        const model = models.find(m => m.id === device.phoneModelId)
        return (
          <div key={device.deviceId} className={styles.deviceCard}>
            <div className={styles.deviceCardHeader}>
              <span className={styles.deviceLabel}>Device {di + 1}</span>
              <button
                type="button"
                className={styles.btnRemove}
                aria-label={`Remove device ${di + 1}`}
                onClick={() => removeDevice(device.deviceId)}
              >
                Remove
              </button>
            </div>

            <div className={styles.fieldRow}>
              <label htmlFor={`model-${device.deviceId}`} className={styles.fieldLabel}>
                Phone model
              </label>
              <select
                id={`model-${device.deviceId}`}
                className={styles.select}
                value={device.phoneModelId}
                onChange={e => updateDevice(device.deviceId, { phoneModelId: e.target.value })}
                aria-label="Phone model"
              >
                <option value="">Select a model…</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label htmlFor={`label-${device.deviceId}`} className={styles.fieldLabel}>
                Label <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id={`label-${device.deviceId}`}
                type="text"
                className={styles.input}
                placeholder="e.g. My work phone"
                value={device.label}
                onChange={e => updateDevice(device.deviceId, { label: e.target.value })}
                maxLength={80}
              />
            </div>

            <div className={styles.fieldRow}>
              <label htmlFor={`notes-${device.deviceId}`} className={styles.fieldLabel}>
                Notes <span className={styles.optional}>(optional)</span>
              </label>
              <textarea
                id={`notes-${device.deviceId}`}
                className={styles.textarea}
                placeholder="Describe the issue…"
                value={device.notes}
                onChange={e => updateDevice(device.deviceId, { notes: e.target.value })}
                rows={2}
                maxLength={1000}
              />
            </div>

            {device.items.length > 0 && (
              <div className={styles.serviceRows}>
                {device.items.map((row, ri) => {
                  const selectedSvc = services.find(s => s.id === row.serviceId)
                  const linePrice = row.serviceId && device.phoneModelId
                    ? priceFor(matrix, row.serviceId, device.phoneModelId, row.variant)
                    : null

                  return (
                    <div key={row.itemId} className={styles.serviceRow}>
                      <div className={styles.serviceRowFields}>
                        <div className={styles.fieldGroup}>
                          <label
                            htmlFor={`svc-${row.itemId}`}
                            className={styles.fieldLabel}
                          >
                            Service {ri + 1}
                          </label>
                          <select
                            id={`svc-${row.itemId}`}
                            className={styles.select}
                            value={row.serviceId}
                            onChange={e =>
                              updateServiceRow(device.deviceId, row.itemId, {
                                serviceId: e.target.value,
                                variant: null,
                              })
                            }
                            aria-label="Service"
                          >
                            <option value="">Select a service…</option>
                            {services.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        {selectedSvc?.hasVariants && selectedSvc.variants.length > 0 && (
                          <div className={styles.fieldGroup}>
                            <label
                              htmlFor={`variant-${row.itemId}`}
                              className={styles.fieldLabel}
                            >
                              Variant <span className={styles.variantRequired}>(required)</span>
                            </label>
                            <select
                              id={`variant-${row.itemId}`}
                              className={`${styles.select}${row.variant === null ? ` ${styles.selectRequired}` : ''}`}
                              value={row.variant ?? ''}
                              onChange={e =>
                                updateServiceRow(device.deviceId, row.itemId, {
                                  variant: e.target.value || null,
                                })
                              }
                              aria-label="Variant"
                              aria-required="true"
                            >
                              <option value="">Select option…</option>
                              {selectedSvc.variants.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className={styles.serviceRowMeta}>
                        {linePrice != null ? (
                          <span className={styles.linePrice}>{formatPula(linePrice)}</span>
                        ) : (
                          <span className={styles.linePriceEmpty}>—</span>
                        )}
                        <button
                          type="button"
                          className={styles.btnRemoveSmall}
                          aria-label={`Remove service ${ri + 1}`}
                          onClick={() => removeServiceRow(device.deviceId, row.itemId)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              className={styles.btnAddService}
              onClick={() => addServiceRow(device.deviceId)}
              disabled={!device.phoneModelId}
            >
              + Add service
            </button>
          </div>
        )
      })}

      <button
        type="button"
        className={styles.btnAddDevice}
        onClick={addDevice}
      >
        + Add device
      </button>

      {totalThebe > 0 && (
        <div className={styles.stickyTotal} aria-live="polite">
          <span className={styles.totalLabel}>Estimated total</span>
          <span className={styles.totalAmount}>{formatPula(totalThebe)}</span>
        </div>
      )}

      {canReview && (
        <div className={styles.reviewBar}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setPhase('review')}
          >
            Review booking
          </button>
        </div>
      )}
    </div>
  )
}
