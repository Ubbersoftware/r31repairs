import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { MobileCta } from '@/components/layout/MobileCta'
import styles from './layout.module.css'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className={styles.main}>{children}</main>
      <Footer />
      <MobileCta />
    </>
  )
}
