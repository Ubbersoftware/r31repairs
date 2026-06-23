// src/components/admin/ImageUploader.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const uploadBytesSpy = vi.fn(async () => ({ ref: {} }))
const getDownloadURLSpy = vi.fn(async () => 'https://example.com/img.png')
vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, _path: string) => ({})),
  uploadBytes: (...a: Parameters<typeof uploadBytesSpy>) => uploadBytesSpy(...a),
  getDownloadURL: (...a: Parameters<typeof getDownloadURLSpy>) => getDownloadURLSpy(...a),
}))

vi.mock('@/lib/firebase/client', () => ({
  auth: { currentUser: { getIdToken: async () => 'owner-token' } },
  storage: {},
}))

const setServiceImageSpy = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/app/admin/catalog/actions', () => ({
  setServiceImageAction: (...a: Parameters<typeof setServiceImageSpy>) =>
    setServiceImageSpy(...a),
}))

import { ImageUploader } from './ImageUploader'

beforeEach(() => {
  uploadBytesSpy.mockClear()
  getDownloadURLSpy.mockClear()
  setServiceImageSpy.mockClear()
})

describe('ImageUploader', () => {
  it('shows type error and does not upload when file type is disallowed', () => {
    render(<ImageUploader serviceId="battery" current={null} />)
    const input = screen.getByLabelText('Upload service image')
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Use a JPEG, PNG, or WebP image')
    expect(uploadBytesSpy).not.toHaveBeenCalled()
    expect(setServiceImageSpy).not.toHaveBeenCalled()
  })

  it('shows size error and does not upload when allowed-type file exceeds 5 MB', () => {
    render(<ImageUploader serviceId="battery" current={null} />)
    const input = screen.getByLabelText('Upload service image')
    const file = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 6_000_000 })
    fireEvent.change(input, { target: { files: [file] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Image must be under 5 MB')
    expect(uploadBytesSpy).not.toHaveBeenCalled()
    expect(setServiceImageSpy).not.toHaveBeenCalled()
  })
})
