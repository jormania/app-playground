// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastStack } from './ToastStack'

afterEach(cleanup)

describe('ToastStack', () => {
  it('renders nothing with an empty list', () => {
    const { container } = render(<ToastStack toasts={[]} onDismiss={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders each toast’s message', () => {
    render(<ToastStack toasts={[{ id: 'a', message: 'Kept it' }]} onDismiss={() => {}} />)
    expect(screen.getByText('Kept it')).toBeTruthy()
  })

  it('fires the action AND dismisses on click, in that order', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const onDismiss = vi.fn((id: string) => calls.push(`dismiss:${id}`))
    const onAction = vi.fn(() => calls.push('action'))
    render(<ToastStack
      toasts={[{ id: 'a', message: 'Removed', actionLabel: 'Undo', onAction }]}
      onDismiss={onDismiss}
    />)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(calls).toEqual(['action', 'dismiss:a'])
  })

  it('the × button dismisses without touching the action', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(<ToastStack
      toasts={[{ id: 'a', message: 'Removed', actionLabel: 'Undo', onAction }]}
      onDismiss={onDismiss}
    />)
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledWith('a')
    expect(onAction).not.toHaveBeenCalled()
  })
})
