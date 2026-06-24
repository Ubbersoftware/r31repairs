// src/app/(customer)/book/BookingBuilder.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createSpy: ReturnType<typeof vi.fn> = vi.fn(async () => ({ ok: true, orderId: 'o1' }))
vi.mock('@/app/(customer)/orders/actions', () => ({
  createOrderAction: (...a: unknown[]) => (createSpy as (...args: unknown[]) => unknown)(...a),
}))
vi.mock('@/lib/firebase/client', () => ({
  auth: { currentUser: { getIdToken: async () => 'cust' } },
}))
const next = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: next, refresh: vi.fn() }) }))

import { BookingBuilder } from './BookingBuilder'
import type { Service, PhoneModel, PriceDoc } from '@/lib/types/catalog'

const services: Service[] = [
  {
    id: 'battery',
    name: 'Battery Replacement',
    slug: 'battery',
    hasVariants: false,
    variants: [],
    active: true,
    sortOrder: 1,
    imageURL: null,
    category: 'power',
    description: '',
  },
  {
    id: 'screen',
    name: 'Screen Repair',
    slug: 'screen',
    hasVariants: true,
    variants: ['Basic', 'OLED'],
    active: true,
    sortOrder: 2,
    imageURL: null,
    category: 'screen',
    description: '',
  },
]
const models: PhoneModel[] = [
  { id: 'iphone-13', name: 'iPhone 13', brand: 'Apple', active: true, sortOrder: 1 },
]
const matrix: PriceDoc[] = [
  { serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 60000, available: true },
  { serviceId: 'screen', modelId: 'iphone-13', variant: 'Basic', amount: 120000, available: true },
  { serviceId: 'screen', modelId: 'iphone-13', variant: 'OLED', amount: 200000, available: true },
]

beforeEach(() => {
  createSpy.mockClear()
  next.mockClear()
})

describe('BookingBuilder', () => {
  it('adds a device + service, shows the live total, and submits a booking', async () => {
    render(<BookingBuilder services={services} models={models} matrix={matrix} />)

    // Step 1: Add a device
    fireEvent.click(screen.getByRole('button', { name: /add device/i }))

    // Step 2: Select a phone model (first/only select in the device card)
    const modelSelect = screen.getByRole('combobox', { name: /phone model/i })
    fireEvent.change(modelSelect, { target: { value: 'iphone-13' } })

    // Step 3: Add a service to the device
    fireEvent.click(screen.getByRole('button', { name: /add service/i }))

    // Step 4: Select a service (selects should exist after adding a service row)
    const serviceSelect = screen.getByRole('combobox', { name: /service/i })
    fireEvent.change(serviceSelect, { target: { value: 'battery' } })

    // Step 5: Live estimated total should show P600 (60000 thebe)
    // The sticky total region uses aria-live="polite" and contains "Estimated total" + the Pula amount
    const liveRegion = screen.getByText('Estimated total').closest('[aria-live]')
    expect(liveRegion).toBeTruthy()
    expect(liveRegion?.textContent).toMatch(/P600/)

    // Step 6: Click Review
    fireEvent.click(screen.getByRole('button', { name: /review/i }))

    // Step 7: Confirm summary is shown, then confirm
    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    // Step 8: Should show success state
    await screen.findByText(/booked|success|confirmed/i)

    // Step 9: createOrderAction called with idToken + devices array
    expect(createSpy).toHaveBeenCalledWith(
      'cust',
      expect.objectContaining({ devices: expect.any(Array) }),
    )

    // Step 10: Router should have navigated to the order
    expect(next).toHaveBeenCalledWith('/orders/o1')
  })

  it('shows an error alert when createOrderAction fails', async () => {
    createSpy.mockResolvedValueOnce({ ok: false, error: 'INVALID', message: 'price unavailable' })

    render(<BookingBuilder services={services} models={models} matrix={matrix} />)

    fireEvent.click(screen.getByRole('button', { name: /add device/i }))
    const modelSelect = screen.getByRole('combobox', { name: /phone model/i })
    fireEvent.change(modelSelect, { target: { value: 'iphone-13' } })
    fireEvent.click(screen.getByRole('button', { name: /add service/i }))
    const serviceSelect = screen.getByRole('combobox', { name: /service/i })
    fireEvent.change(serviceSelect, { target: { value: 'battery' } })

    fireEvent.click(screen.getByRole('button', { name: /review/i }))
    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
  })

  it('blocks Review when a variant-requiring service has no variant selected, unblocks after selection', () => {
    render(<BookingBuilder services={services} models={models} matrix={matrix} />)

    // Add device and select model
    fireEvent.click(screen.getByRole('button', { name: /add device/i }))
    const modelSelect = screen.getByRole('combobox', { name: /phone model/i })
    fireEvent.change(modelSelect, { target: { value: 'iphone-13' } })

    // Add service row and select the variant-requiring "screen" service
    fireEvent.click(screen.getByRole('button', { name: /add service/i }))
    const serviceSelect = screen.getByRole('combobox', { name: /service/i })
    fireEvent.change(serviceSelect, { target: { value: 'screen' } })

    // Review button should NOT be present (canReview is false)
    expect(screen.queryByRole('button', { name: /review/i })).toBeNull()

    // Variant select should be visible and show "Select option…" (required state)
    const variantSelect = screen.getByRole('combobox', { name: /variant/i })
    expect(variantSelect).toBeInTheDocument()
    expect((variantSelect as HTMLSelectElement).value).toBe('')

    // Select a variant
    fireEvent.change(variantSelect, { target: { value: 'Basic' } })

    // Now Review button should appear
    expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument()
  })
})
