// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberStepper } from './NumberStepper'

afterEach(cleanup)

describe('NumberStepper', () => {
  it('renders the label and current value', () => {
    render(<NumberStepper label="Rounds" value={8} onChange={() => {}} />)
    expect(screen.getByText('Rounds')).toBeTruthy()
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('8')
  })

  it('increments and decrements by step', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<NumberStepper label="Rounds" value={8} step={2} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Increase' }))
    expect(onChange).toHaveBeenCalledWith(10)

    await user.click(screen.getByRole('button', { name: 'Decrease' }))
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('disables decrease at min and increase at max, and never calls past the bound', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<NumberStepper label="Rounds" value={1} min={1} max={1} onChange={onChange} />)

    const decrease = screen.getByRole('button', { name: 'Decrease' })
    const increase = screen.getByRole('button', { name: 'Increase' })
    expect(decrease.hasAttribute('disabled')).toBe(true)
    expect(increase.hasAttribute('disabled')).toBe(true)

    await user.click(decrease)
    await user.click(increase)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('updates on direct typing, clamped to min/max', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<NumberStepper label="Rounds" value={5} min={1} max={10} onChange={onChange} />)

    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '99')
    expect(onChange).toHaveBeenLastCalledWith(10)
  })
})
