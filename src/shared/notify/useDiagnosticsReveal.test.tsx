// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDiagnosticsReveal } from './useDiagnosticsReveal'

afterEach(cleanup)

function Hint({ onReveal, tapCount, windowMs }: { onReveal: () => void; tapCount?: number; windowMs?: number }) {
  const onTap = useDiagnosticsReveal(onReveal, tapCount, windowMs)
  return <p onClick={onTap}>hint</p>
}

describe('useDiagnosticsReveal', () => {
  it('reveals after the configured number of quick taps', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<Hint onReveal={onReveal} tapCount={3} />)
    const hint = screen.getByText('hint')
    await user.click(hint)
    await user.click(hint)
    expect(onReveal).not.toHaveBeenCalled()
    await user.click(hint)
    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  it('resets the count once revealed', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<Hint onReveal={onReveal} tapCount={2} />)
    const hint = screen.getByText('hint')
    await user.click(hint)
    await user.click(hint)
    expect(onReveal).toHaveBeenCalledTimes(1)
    await user.click(hint)
    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  it('resets the count once a tap falls outside the window', async () => {
    vi.useFakeTimers()
    const onReveal = vi.fn()
    render(<Hint onReveal={onReveal} tapCount={3} windowMs={100} />)
    const hint = screen.getByText('hint')
    hint.click()
    vi.advanceTimersByTime(200) // outside the window — count restarts at 1
    hint.click()
    hint.click()
    expect(onReveal).not.toHaveBeenCalled()
    hint.click()
    expect(onReveal).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
