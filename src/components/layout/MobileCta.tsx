import { Button } from '@/components/ui/Button'
import styles from './MobileCta.module.css'

export function MobileCta() {
  return (
    <div className={styles.bar}>
      <Button href="/book" block size="lg">
        Book a repair
      </Button>
    </div>
  )
}
