import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignaturePad } from './SignaturePad'

beforeAll(() => {
  // jsdom canvas: stub getContext + toDataURL
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    clearRect: vi.fn(), lineWidth: 0, lineCap: '', strokeStyle: '',
  })) as never
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,AAAA')
})

describe('SignaturePad', () => {
  it('confirm is disabled until a stroke, then calls onConfirm with the PNG', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<SignaturePad onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: /confirm/i })
    expect(confirm).toBeDisabled()

    const canvas = screen.getByLabelText(/signature/i)
    await userEvent.pointer([{ target: canvas, keys: '[MouseLeft>]', coords: { x: 5, y: 5 } }, { coords: { x: 20, y: 20 } }, { keys: '[/MouseLeft]' }])
    expect(confirm).toBeEnabled()

    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('data:image/png;base64,AAAA')
  })
})
