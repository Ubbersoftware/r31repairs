// src/app/admin/settings/SettingsForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// --- mocks (must come before imports that use them) ---

const mockSettingsData = {
  name: '31 Repairs',
  address: '123 Main St',
  mapURL: '',
  phone: '71234567',
  instagram: '@31repairs',
  logoURL: null,
  paymentChannels: [
    { id: 'bank_transfer', label: 'Bank transfer', payToLabel: 'Bank account', details: 'FNB 0000' },
    { id: 'orange_money',  label: 'Orange Money',  payToLabel: 'Merchant',     details: 'OM 0000' },
  ],
  warrantyMonths: 3,
  updatedAt: 0,
  updatedBy: '',
}

vi.mock('firebase/firestore', async () => {
  const { collection, getDocs, query, where, doc, getDoc } = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore')
  return {
    collection,
    getDocs,
    query,
    where,
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(async () => ({
      exists: () => true,
      data: () => mockSettingsData,
    })),
  }
})

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn(async () => ({ ref: {} })),
  getDownloadURL: vi.fn(async () => 'https://example.com/logo.png'),
}))

vi.mock('@/lib/firebase/client', () => ({
  auth: { currentUser: { getIdToken: async () => 'owner-token' } },
  db: {},
  storage: {},
}))

const updateSettingsSpy = vi.fn(async () => ({ ok: true as const }))
vi.mock('./actions', () => ({
  updateSettingsAction: (...args: unknown[]) => updateSettingsSpy(...args),
}))

// Mock dynamic import of firebase/firestore for the owners query inside useEffect
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({
    exists: () => true,
    data: () => mockSettingsData,
  })),
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] })),
  query: vi.fn((q: unknown) => q),
  where: vi.fn(() => ({})),
}))

import { SettingsForm } from './SettingsForm'

beforeEach(() => {
  updateSettingsSpy.mockClear()
  updateSettingsSpy.mockResolvedValue({ ok: true })
})

describe('SettingsForm', () => {
  it('renders loading state initially, then shows form', async () => {
    render(<SettingsForm />)
    // Loading state may appear briefly
    await waitFor(() => expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument())
  })

  it('shows the shop profile section with fields', async () => {
    render(<SettingsForm />)
    await waitFor(() => expect(screen.getByLabelText(/name/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument()
  })

  it('shows payment channels with payToLabel and details fields', async () => {
    render(<SettingsForm />)
    await waitFor(() => expect(screen.getByText('Bank transfer')).toBeInTheDocument())
    expect(screen.getByText('Orange Money')).toBeInTheDocument()
    // Should render payToLabel inputs for each channel
    const payToLabels = screen.getAllByLabelText(/pay-to label/i)
    expect(payToLabels.length).toBe(2)
  })

  it('shows the warranty months input', async () => {
    render(<SettingsForm />)
    await waitFor(() => expect(screen.getByLabelText(/warranty period/i)).toBeInTheDocument())
    const warrantyInput = screen.getByLabelText(/warranty period/i) as HTMLInputElement
    expect(warrantyInput.type).toBe('number')
    expect(warrantyInput.min).toBe('1')
    expect(warrantyInput.max).toBe('24')
  })

  it('calls updateSettingsAction with idToken on submit', async () => {
    render(<SettingsForm />)
    await waitFor(() => expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))
    await waitFor(() => expect(updateSettingsSpy).toHaveBeenCalledWith('owner-token', expect.objectContaining({ name: '31 Repairs' })))
  })

  it('shows success message after save', async () => {
    render(<SettingsForm />)
    await waitFor(() => expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))
    await waitFor(() => expect(screen.getByText(/settings saved/i)).toBeInTheDocument())
  })

  it('shows error message when action returns error', async () => {
    updateSettingsSpy.mockResolvedValueOnce({ ok: false, error: 'INVALID' })
    render(<SettingsForm />)
    await waitFor(() => expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))
    await waitFor(() => expect(screen.getByText('INVALID')).toBeInTheDocument())
  })

  it('updates a text field when typed into', async () => {
    render(<SettingsForm />)
    await waitFor(() => expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument())
    const nameInput = screen.getByLabelText(/^name$/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'New Shop Name' } })
    expect(nameInput.value).toBe('New Shop Name')
  })

  it('updates warrantyMonths when changed', async () => {
    render(<SettingsForm />)
    await waitFor(() => expect(screen.getByLabelText(/warranty period/i)).toBeInTheDocument())
    const warrantyInput = screen.getByLabelText(/warranty period/i) as HTMLInputElement
    fireEvent.change(warrantyInput, { target: { value: '6' } })
    expect(warrantyInput.value).toBe('6')
  })
})
