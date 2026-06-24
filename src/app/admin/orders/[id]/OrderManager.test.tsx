// src/app/admin/orders/[id]/OrderManager.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const statusSpy = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/app/admin/orders/actions', () => ({
  changeOrderStatusAction: (...a: Parameters<typeof statusSpy>) => statusSpy(...a),
  cancelOrderAction: vi.fn(async () => ({ ok: true })),
  editLineAction: vi.fn(async () => ({ ok: true })),
  addOrderNoteAction: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'owner' } } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { OrderManager } from './OrderManager'
const baseOrder = { id: 'o1', orderNumber: 'R31-0001', customerName: 'Thabo', customerPhone: '7', devices: [{ deviceId: 'd1', modelName: 'iPhone 13' }], items: [{ itemId: 'i1', deviceId: 'd1', serviceName: 'Screen', quotedAmount: 150000 }], estimatedTotal: 150000 }
const order = { ...baseOrder, status: 'placed' } as never
const orderAwaitingParts = { ...baseOrder, status: 'awaiting_parts' } as never
beforeEach(() => statusSpy.mockClear())

describe('OrderManager', () => {
  it('advances status via the primary action', async () => {
    render(<OrderManager order={order} events={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /device received/i }))
    await screen.findByText(/updated|saved/i)
    expect(statusSpy).toHaveBeenCalledWith('owner', 'o1', 'received', undefined)
  })

  it('shows a primary action for awaiting_parts that targets in_repair', async () => {
    render(<OrderManager order={orderAwaitingParts} events={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /mark in repair/i }))
    await screen.findByText(/updated|saved/i)
    expect(statusSpy).toHaveBeenCalledWith('owner', 'o1', 'in_repair', undefined)
  })
})
