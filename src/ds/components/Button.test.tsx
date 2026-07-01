// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

afterEach(cleanup)

describe('Button', () => {
  it('renders its children and defaults to type="button"', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('fires onClick, but not while disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<Button onClick={onClick} disabled>Go</Button>)
    const btn = screen.getByRole('button', { name: 'Go' })
    expect(btn.hasAttribute('disabled')).toBe(true)
    await user.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('reflects the variant in its class list', () => {
    const { rerender } = render(<Button variant="primary">A</Button>)
    const primary = screen.getByRole('button').className
    rerender(<Button variant="ghost">A</Button>)
    const ghost = screen.getByRole('button').className
    expect(primary).not.toBe(ghost)
  })
})
