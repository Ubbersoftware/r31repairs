import { getActiveServices, getActiveModels, getPriceMatrix } from '@/lib/catalog/queries'
import { BookingBuilder } from './BookingBuilder'

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
