import type { Faq } from '@/lib/types/catalog'

const RAW: { question: string; answer: string }[] = [
  { question: 'Are the prices final?', answer: 'The prices shown are seed estimates from our current rates. We confirm the exact quote once we have seen your device, since the final cost can depend on the model and the extent of the damage.' },
  { question: 'How long does a repair take?', answer: 'Most common repairs — screens and batteries — are completed the same day. You can follow your repair live in the app as it moves from received to ready for collection, and we notify you the moment it is done.' },
  { question: 'What does the warranty cover?', answer: 'Every completed repair comes with a 3-month warranty that starts on the date we finish the job. You can view your warranty and raise a claim any time from your account.' },
  { question: "What's the difference between a Basic and an OLED screen?", answer: 'Both screens are tested and fully functional. OLED is the premium option — it delivers the most accurate colour and brightness, just like the original Apple display. Basic is a quality, more affordable alternative.' },
  { question: 'How do I pay?', answer: 'Payment is made at collection by cash or bank transfer. If you pay by transfer, you upload a screenshot as proof of payment in the app and we verify it. You can also choose to pay in advance once an invoice has been raised.' },
  { question: 'Where are you located?', answer: 'We are at Plot 594 Sekgoma, Gaborone. Drop your device with us, and track the repair from your phone until it is ready to collect.' },
]

export const FAQ_SEED: Faq[] = RAW.map((r, i) => ({
  id: `faq-${i + 1}`,
  question: r.question,
  answer: r.answer,
  category: 'general',
  active: true,
  sortOrder: i + 1,
}))
