import Link from 'next/link'
import { Hero } from '@/components/marketing/Hero'
import { HowItWorks } from '@/components/marketing/HowItWorks'
import { ServiceCard } from '@/components/ui/ServiceCard'
import { Faq } from '@/components/ui/Faq'
import { Button } from '@/components/ui/Button'
import { SEED_SERVICES } from '@/lib/catalog/seed'
import { fromPrice } from '@/lib/catalog/pricing'
import { formatPula } from '@/lib/money'
import { FAQ_ITEMS } from '@/lib/content/faq'
import styles from './page.module.css'

const SERVICE_ICONS: Record<string, string> = {
  screen: '📱',
  battery: '🔋',
  'back-glass': '🪟',
}

const MAP_URL = 'https://maps.app.goo.gl/yums9aXYCW93K94a8'

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />

      <section className="section">
        <div className="container">
          <p className="overline">Popular repairs</p>
          <h2 className={styles.heading}>Fixed fast, priced up front.</h2>
          <div className={styles.cards}>
            {SEED_SERVICES.filter((s) => s.active).map((s) => {
              const from = fromPrice(s.slug)
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

      <section className="section">
        <div className="container">
          <p className="overline">FAQ</p>
          <h2 className={styles.heading}>Good to know.</h2>
          <Faq items={FAQ_ITEMS.slice(0, 4)} />
          <p className={styles.faqMore}>
            <Link href="/faq">See all questions →</Link>
          </p>
        </div>
      </section>

      <section className={`${styles.contact} section`}>
        <div className="container">
          <p className="overline">Visit us</p>
          <h2 className={styles.heading}>Drop in, or book ahead.</h2>
          <div className={styles.contactGrid}>
            <div>
              <h3 className={styles.contactLabel}>Where</h3>
              <a href={MAP_URL} target="_blank" rel="noopener noreferrer">
                Plot 594 Sekgoma, Gaborone
              </a>
            </div>
            <div>
              <h3 className={styles.contactLabel}>Call</h3>
              <a href="tel:+26775443175">+267 75 443 175</a>
            </div>
            <div>
              <h3 className={styles.contactLabel}>Instagram</h3>
              <a href="https://instagram.com/31.Repairs" target="_blank" rel="noopener noreferrer">
                @31.Repairs
              </a>
            </div>
          </div>
          <div className={styles.contactCta}>
            <Button href="/book" variant="secondary" size="lg">
              Book a repair
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
