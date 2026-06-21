import Link from 'next/link'
import styles from './Footer.module.css'

const MAP_URL = 'https://maps.app.goo.gl/yums9aXYCW93K94a8'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.cols}>
          <div>
            <h5>31Repairs</h5>
            <p className={styles.muted}>iPhone repairs in Gaborone — booked and tracked.</p>
          </div>
          <div>
            <h5>Services</h5>
            <Link href="/services">All services</Link>
            <Link href="/services/screen">Screen replacement</Link>
            <Link href="/services/battery">Battery replacement</Link>
            <Link href="/services/back-glass">Back glass</Link>
          </div>
          <div>
            <h5>Company</h5>
            <Link href="/#how">How it works</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/login">Sign in</Link>
          </div>
          <div>
            <h5>Visit us</h5>
            <a href={MAP_URL} target="_blank" rel="noopener noreferrer">
              Plot 594 Sekgoma, Gaborone
            </a>
            <a href="tel:+26775443175">+267 75 443 175</a>
            <a href="https://instagram.com/31.Repairs" target="_blank" rel="noopener noreferrer">
              @31.Repairs
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
