import type { Metadata } from 'next'
import { ServiceCard } from '@/components/ui/ServiceCard'
import { getActiveServices, getPriceMatrix } from '@/lib/catalog/queries'
import { fromPrice } from '@/lib/catalog/pricing'
import { formatPula } from '@/lib/money'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Services & pricing — 31Repairs',
  description: 'iPhone screen, battery and back-glass repair pricing for every model.',
}

export const revalidate = 3600

const SERVICE_ICONS: Record<string, string> = {
  screen: '📱',
  battery: '🔋',
  'back-glass': '🪟',
}

export default async function ServicesPage() {
  const [services, matrix] = await Promise.all([getActiveServices(), getPriceMatrix()])
  return (
    <section className="section">
      <div className="container">
        <p className="overline">Services & pricing</p>
        <h1>What can we fix?</h1>
        <p className={styles.intro}>
          Pick a repair to see live pricing for your iPhone. All prices are in Pula and
          include a 3-month warranty.
        </p>
        <div className={styles.grid}>
          {services.map((s) => {
            const from = fromPrice(matrix, s.id)
            return (
              <ServiceCard
                key={s.id}
                href={`/services/${s.slug}`}
                icon={SERVICE_ICONS[s.slug]}
                title={s.name}
                desc={s.description}
                priceFrom={from !== null ? `From ${formatPula(from)}` : 'Ask in store'}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
