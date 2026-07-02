// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from './SegmentedControl'

afterEach(cleanup)

const OPTIONS = [
  { value: 'prepare', label: 'Prep' },
  { value: 'work', label: 'Work' },
  { value: 'rest', label: 'Rest' },
]

describe('SegmentedControl', () => {
  it('renders every option', () => {
    render(<SegmentedControl options={OPTIONS} value="work" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Prep' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Work' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Rest' })).toBeTruthy()
  })

  it('marks the active option as checked and the rest as not', () => {
    render(<SegmentedControl options={OPTIONS} value="rest" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Rest' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Work' }).getAttribute('aria-checked')).toBe('false')
  })

  it('calls onChange with the clicked option value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="work" onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'Rest' }))
    expect(onChange).toHaveBeenCalledWith('rest')
  })
})
