// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Card } from './Card'

afterEach(cleanup)

describe('Card', () => {
  it('renders its children and defaults to type="button"', () => {
    render(<Card>Rounds</Card>)
    const card = screen.getByRole('button', { name: 'Rounds' })
    expect(card).toBeTruthy()
    expect(card.getAttribute('type')).toBe('button')
  })

  it('fires onClick, but not while disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(<Card onClick={onClick}>Pick me</Card>)
    await user.click(screen.getByRole('button', { name: 'Pick me' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <Card onClick={onClick} disabled>
        Pick me
      </Card>,
    )
    await user.click(screen.getByRole('button', { name: 'Pick me' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('reflects the selected state in its class list', () => {
    const { rerender } = render(<Card>Rounds</Card>)
    const plain = screen.getByRole('button').className
    rerender(<Card selected>Rounds</Card>)
    const selected = screen.getByRole('button').className
    expect(plain).not.toBe(selected)
  })
})
