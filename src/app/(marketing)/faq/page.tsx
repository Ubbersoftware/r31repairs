import type { Metadata } from 'next'
import { Faq } from '@/components/ui/Faq'
import { getActiveFaqs } from '@/lib/catalog/queries'

export const metadata: Metadata = {
  title: 'FAQ — 31Repairs',
  description: 'Common questions about iPhone repair pricing, turnaround, warranty and payment.',
}

export const revalidate = 3600

export default async function FaqPage() {
  const faqs = await getActiveFaqs()
  return (
    <section className="section">
      <div className="container prose">
        <p className="overline">FAQ</p>
        <h1>Frequently asked questions</h1>
        <Faq items={faqs.map((f) => ({ q: f.question, a: f.answer }))} />
      </div>
    </section>
  )
}
