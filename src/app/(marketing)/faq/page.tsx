import type { Metadata } from 'next'
import { Faq } from '@/components/ui/Faq'
import { FAQ_ITEMS } from '@/lib/content/faq'

export const metadata: Metadata = {
  title: 'FAQ — 31Repairs',
  description: 'Common questions about iPhone repair pricing, turnaround, warranty and payment.',
}

export default function FaqPage() {
  return (
    <section className="section">
      <div className="container prose">
        <p className="overline">FAQ</p>
        <h1>Frequently asked questions</h1>
        <Faq items={FAQ_ITEMS} />
      </div>
    </section>
  )
}
