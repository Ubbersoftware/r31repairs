// src/app/admin/orders/OrderQueue.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderQueue } from './OrderQueue'

const orders = [
  { id: 'o1', orderNumber: 'R31-0001', customerName: 'Thabo', status: 'placed', items: [{ serviceName: 'Screen' }], devices: [{ modelName: 'iPhone 13' }], createdAt: 100, estimatedTotal: 150000 },
  { id: 'o2', orderNumber: 'R31-0002', customerName: 'Lesedi', status: 'in_repair', items: [{ serviceName: 'Battery' }], devices: [{ modelName: 'iPhone 12' }], createdAt: 200, estimatedTotal: 60000 },
] as never[]

describe('OrderQueue', () => {
  it('filters by status and searches by name/number', () => {
    render(<OrderQueue orders={orders} />)
    expect(screen.getByText('R31-0001')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /in repair/i }))
    expect(screen.queryByText('R31-0001')).toBeNull()
    expect(screen.getByText('R31-0002')).toBeInTheDocument()
  })
})
