'use client'
import { useState, useMemo } from 'react'
import { auth } from '@/lib/firebase/client'
import { savePricesAction } from '@/app/admin/catalog/actions'
import { priceId } from '@/lib/catalog/ids'
import { toThebe, fromThebe } from '@/lib/money'
import type { Service, PhoneModel, PriceDoc } from '@/lib/types/catalog'
import { Button } from '@/components/ui/Button'
import styles from './PriceMatrixEditor.module.css'

type Col = { serviceId: string; label: string; variant: string | null }

function buildColumns(services: Service[]): Col[] {
  const cols: Col[] = []
  for (const s of services) {
    if (s.hasVariants && s.variants.length) {
      for (const v of s.variants) {
        cols.push({ serviceId: s.id, label: `${s.name} ${v}`, variant: v })
      }
    } else {
      cols.push({ serviceId: s.id, label: s.name, variant: null })
    }
  }
  return cols
}

function buildInitialCells(matrix: PriceDoc[]): Record<string, { amount: number; available: boolean }> {
  const cells: Record<string, { amount: number; available: boolean }> = {}
  for (const p of matrix) {
    cells[priceId(p.serviceId, p.modelId, p.variant)] = { amount: p.amount, available: p.available }
  }
  return cells
}

export function PriceMatrixEditor({
  services,
  models,
  matrix,
}: {
  services: Service[]
  models: PhoneModel[]
  matrix: PriceDoc[]
}) {
  const cols = useMemo(() => buildColumns(services), [services])
  const [cells, setCells] = useState(() => buildInitialCells(matrix))
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  function updateCell(id: string, patch: Partial<{ amount: number; available: boolean }>) {
    setCells((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirty((prev) => new Set(prev).add(id))
    setStatus('idle')
  }

  async function save() {
    setStatus('saving')

    // Robust cols×models reconstruction: iterate cols and models directly,
    // preserving exact col.variant (no string-parsing round-trip).
    const edits = []
    for (const col of cols) {
      for (const m of models) {
        const id = priceId(col.serviceId, m.id, col.variant)
        if (dirty.has(id)) {
          const cell = cells[id]
          edits.push({
            serviceId: col.serviceId,
            modelId: m.id,
            variant: col.variant,
            amount: cell.amount,
            available: cell.available,
          })
        }
      }
    }

    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) {
      setStatus('error')
      return
    }

    const res = await savePricesAction(idToken, edits)
    if (res.ok) {
      setDirty(new Set())
      setStatus('saved')
    } else {
      setStatus('error')
    }
  }

  return (
    <div>
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Model</th>
              {cols.map((c) => (
                <th key={`${c.serviceId}__${c.variant ?? 'none'}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.name}</th>
                {cols.map((c) => {
                  const id = priceId(c.serviceId, m.id, c.variant)
                  const cell = cells[id] ?? { amount: 0, available: false }
                  const isDirty = dirty.has(id)
                  return (
                    <td
                      key={id}
                      className={isDirty ? styles.dirty : undefined}
                      data-label={c.label}
                    >
                      <div className={styles.cellInner}>
                        <input
                          className={styles.priceInput}
                          aria-label={`${c.label} price for ${m.name}`}
                          inputMode="numeric"
                          value={String(Math.round(fromThebe(cell.amount)))}
                          onChange={(e) =>
                            updateCell(id, { amount: toThebe(Number(e.target.value) || 0) })
                          }
                        />
                        <label className={styles.availLabel}>
                          <input
                            type="checkbox"
                            checked={cell.available}
                            aria-label={`${c.label} available for ${m.name}`}
                            onChange={(e) => updateCell(id, { available: e.target.checked })}
                          />
                          <span>Available</span>
                        </label>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.bar}>
        <Button
          type="button"
          onClick={save}
          disabled={!dirty.size || status === 'saving'}
          variant="primary"
        >
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </Button>
        {status === 'saved' && (
          <span role="status" className={styles.savedMsg}>
            Saved
          </span>
        )}
        {status === 'error' && (
          <span role="alert" className={styles.errorMsg}>
            Could not save — check your connection and that you are signed in as an owner.
          </span>
        )}
      </div>
    </div>
  )
}
