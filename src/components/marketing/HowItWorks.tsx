import styles from './HowItWorks.module.css'

const STEPS = [
  { n: '1', title: 'Book online', desc: 'Pick your iPhone, choose a repair, and book in a couple of minutes.' },
  { n: '2', title: 'Drop at the shop', desc: 'Bring your phone to our Gaborone store — Plot 594 Sekgoma.' },
  { n: '3', title: 'Track live', desc: 'Watch your repair move from received to ready, right from your phone.' },
  { n: '4', title: 'Collect & e-sign', desc: 'Pay, sign for collection, and start your 3-month warranty.' },
]

export function HowItWorks() {
  return (
    <section id="how" className={`${styles.how} section`}>
      <div className="container">
        <p className="overline">How it works</p>
        <h2 className={styles.heading}>Four steps, fully tracked.</h2>
        <ol className={styles.grid}>
          {STEPS.map((s) => (
            <li key={s.n} className={styles.step}>
              <span className={styles.num} aria-hidden="true">{s.n}</span>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
