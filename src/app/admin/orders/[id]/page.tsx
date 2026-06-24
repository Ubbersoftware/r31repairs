import { OrderManagerLoader } from './OrderManagerLoader'

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <>
      <p className="overline">Admin · Orders</p>
      <OrderManagerLoader id={id} />
    </>
  )
}
