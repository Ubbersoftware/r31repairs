'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { PriceMatrix, type PriceRow } from './PriceMatrix'
import { priceFor } from '@/lib/catalog/pricing'
import { formatPula } from '@/lib/money'
import type { Service, PhoneModel } from '@/lib/types/catalog'
import styles from './ServiceDetail.module.css'

const SERVICE_ICONS: Record<string, string> = {
  screen: '📱',
  battery: '🔋',
  'back-glass': '🪟',
}

export function ServiceDetail({ service, models }: { service: Service; models: PhoneModel[] }) {
  const [variant, setVariant] = useState<string>(service.variants[0] ?? '')

  const activeVariant = service.hasVariants ? variant : null
  const rows: PriceRow[] = models.map((m) => {
    const amount = priceFor(service.slug, m.id, activeVariant)
    return {
      model: m.name,
      price: amount !== null ? formatPula(amount) : 'Currently unavailable',
      available: amount !== null,
    }
  })

  return (
    <section className="section">
      <div className="container">
        <p className="overline">Service</p>
        <h1>{service.name}</h1>

        <div className={styles.media} aria-hidden="true">
          <span className={styles.icon}>{SERVICE_ICONS[service.slug] ?? '🔧'}</span>
        </div>

        <p className={styles.desc}>{service.description}</p>

        {service.hasVariants && (
          <div className={styles.variants}>
            <SegmentedToggle
              value={variant}
              onChange={setVariant}
              options={service.variants.map((v) => ({
                value: v,
                label: v,
                hint: v === 'OLED' ? 'Premium' : undefined,
              }))}
            />
          </div>
        )}

        <h2 className={styles.matrixHeading}>
          Pricing by model
          {activeVariant ? ` · ${activeVariant}` : ''}
        </h2>
        <PriceMatrix rows={rows} />

        <p className={styles.estimate}>
          Prices are estimates and confirmed once we have seen your device.
        </p>

        <div className={styles.cta}>
          <Button href="/book" size="lg">
            Book a repair
          </Button>
        </div>
      </div>
    </section>
  )
}
