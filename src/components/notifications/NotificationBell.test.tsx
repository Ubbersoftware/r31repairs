// src/components/notifications/NotificationBell.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'

const updateSpy = vi.fn(async () => {})
const push = vi.fn()
let snapCb: (snap: unknown) => void = () => {}
vi.mock('firebase/firestore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: () => ({}), query: (...a: unknown[]) => a as any, where: () => ({}), doc: (_db: unknown, _c: string, id: string) => ({ id }),
  onSnapshot: (_q: unknown, cb: (s: unknown) => void) => { snapCb = cb; return () => {} },
  updateDoc: (...a: unknown[]) => (updateSpy as (...x: unknown[]) => unknown)(...a),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {}, auth: { currentUser: { uid: 'c1' } } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
// useAuth provides the uid; mock to a signed-in customer
vi.mock('@/lib/auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'c1' }, claims: { role: 'customer' }, loading: false }) }))
import { NotificationBell } from './NotificationBell'

function emit(notifs: Record<string, unknown>[]) {
  snapCb({ docs: notifs.map((n) => ({ id: n.id, data: () => n })) })
}
const items = [
  { id: 'n1', userId: 'c1', type: 'status_change', title: 'R31-0001', body: 'Status: Ready for Collection', link: '/orders/o1', read: false, createdAt: 2 },
  { id: 'n2', userId: 'c1', type: 'price_update', title: 'R31-0001', body: 'Your quote was updated', link: '/orders/o1', read: true, createdAt: 1 },
]
beforeEach(() => { updateSpy.mockClear(); push.mockClear() })

describe('NotificationBell', () => {
  it('shows the unread count and lists notifications newest-first', () => {
    render(<NotificationBell />)
    act(() => emit(items))
    expect(screen.getByLabelText(/1 unread/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Status: Ready for Collection')).toBeInTheDocument()
  })
  it('marks an item read and navigates on click', async () => {
    render(<NotificationBell />)
    act(() => emit(items))
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    fireEvent.click(screen.getByText('Status: Ready for Collection'))
    expect(updateSpy).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/orders/o1')
  })
})
