import { getActiveServices, getActiveModels, getPriceMatrix } from '@/lib/catalog/queries'
import { BookingBuilder } from './BookingBuilder'

// Time backstop so catalog changes reach the booking page even without an owner save;
// owner catalog saves also call revalidatePath('/book') for immediate refresh.
export const revalidate = 3600

export default async function BookPage() {
  const [services, models, matrix] = await Promise.all([
    getActiveServices(),
    getActiveModels(),
    getPriceMatrix(),
  ])

  return (
    <>
      <p className="overline">Book a repair</p>
      <h1>What needs fixing?</h1>
      <BookingBuilder services={services} models={models} matrix={matrix} />
    </>
  )
}
