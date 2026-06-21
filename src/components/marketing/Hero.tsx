import { Button } from '@/components/ui/Button'
import styles from './Hero.module.css'

export function Hero() {
  return (
    <section className={`${styles.hero} section`}>
      <div className="container prose">
        <p className="overline">Trusted iPhone repairs · Gaborone</p>
        <h1 className={styles.title}>
          Repairs done right.
          <br />
          Every single time.
        </h1>
        <p className={styles.sub}>
          Screen, battery and back-glass repairs for every iPhone — booked online,
          fixed by our team, and backed by a 3-month warranty.
        </p>
        <div className={styles.cta}>
          <Button href="/book" size="lg">
            Book a repair
          </Button>
          <Button href="/services" variant="secondary" size="lg">
            See pricing
          </Button>
        </div>
        <p className={styles.note}>Drop-off in store · Live status tracking · 3-month warranty</p>
      </div>
    </section>
  )
}
