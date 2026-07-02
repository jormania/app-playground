// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IconButton } from './IconButton'

afterEach(cleanup)

describe('IconButton', () => {
  it('renders an accessible, type="button" control', () => {
    render(<IconButton aria-label="Move up">↑</IconButton>)
    const btn = screen.getByRole('button', { name: 'Move up' })
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('fires onClick, but not while disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(
      <IconButton aria-label="Move up" onClick={onClick}>
        ↑
      </IconButton>,
    )
    await user.click(screen.getByRole('button', { name: 'Move up' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <IconButton aria-label="Move up" onClick={onClick} disabled>
        ↑
      </IconButton>,
    )
    await user.click(screen.getByRole('button', { name: 'Move up' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('exposes the selected state via aria-pressed and class', () => {
    const { rerender } = render(<IconButton aria-label="Toggle">◐</IconButton>)
    const plain = screen.getByRole('button').className
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBeNull()

    rerender(
      <IconButton aria-label="Toggle" selected>
        ◐
      </IconButton>,
    )
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button').className).not.toBe(plain)
  })
})
