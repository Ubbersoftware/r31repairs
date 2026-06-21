export interface FaqItem {
  q: string
  a: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Are the prices final?',
    a: 'The prices shown are seed estimates from our current rates. We confirm the exact quote once we have seen your device, since the final cost can depend on the model and the extent of the damage.',
  },
  {
    q: 'How long does a repair take?',
    a: 'Most common repairs — screens and batteries — are completed the same day. You can follow your repair live in the app as it moves from received to ready for collection, and we notify you the moment it is done.',
  },
  {
    q: 'What does the warranty cover?',
    a: 'Every completed repair comes with a 3-month warranty that starts on the date we finish the job. You can view your warranty and raise a claim any time from your account.',
  },
  {
    q: "What's the difference between a Basic and an OLED screen?",
    a: 'Both screens are tested and fully functional. OLED is the premium option — it delivers the most accurate colour and brightness, just like the original Apple display. Basic is a quality, more affordable alternative.',
  },
  {
    q: 'How do I pay?',
    a: 'Payment is made at collection by cash or bank transfer. If you pay by transfer, you upload a screenshot as proof of payment in the app and we verify it. You can also choose to pay in advance once an invoice has been raised.',
  },
  {
    q: 'Where are you located?',
    a: 'We are at Plot 594 Sekgoma, Gaborone. Drop your device with us, and track the repair from your phone until it is ready to collect.',
  },
]
