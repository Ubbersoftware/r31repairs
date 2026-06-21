import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedToggle } from './SegmentedToggle'

describe('SegmentedToggle', () => {
  it('marks the active option and emits onChange', async () => {
    const onChange = vi.fn()
    render(
      <SegmentedToggle
        value="basic"
        onChange={onChange}
        options={[
          { value: 'basic', label: 'Basic' },
          { value: 'oled', label: 'OLED' },
        ]}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Basic' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'OLED' }))
    expect(onChange).toHaveBeenCalledWith('oled')
  })
})
