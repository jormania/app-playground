// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

afterEach(cleanup)

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>body</p>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders an accessible dialog labelled by its title when open', () => {
    render(
      <Modal open onClose={() => {}} title="Confirm">
        <p>body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const title = screen.getByRole('heading', { name: 'Confirm' })
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id)
  })

  it('closes on Escape, the × button, and a backdrop click', async () => {
    const user = userEvent.setup()

    const onClose1 = vi.fn()
    const { unmount } = render(
      <Modal open onClose={onClose1} title="A"><button>inner</button></Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose1).toHaveBeenCalledTimes(1)
    unmount()

    const onClose2 = vi.fn()
    render(<Modal open onClose={onClose2} title="B"><button>inner</button></Modal>)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose2).toHaveBeenCalledTimes(1)
    cleanup()

    const onClose3 = vi.fn()
    render(<Modal open onClose={onClose3} title="C"><button>inner</button></Modal>)
    // The scrim is the aria-hidden sibling before the dialog.
    const scrim = document.querySelector('[aria-hidden="true"]') as HTMLElement
    await user.click(scrim)
    expect(onClose3).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog on open and traps Tab', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={() => {}} title="Trap">
        <button>first</button>
        <button>last</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    // The × button is the first focusable, so focus lands inside the dialog on open.
    const close = screen.getByRole('button', { name: 'Close' })
    const last = screen.getByRole('button', { name: 'last' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(close)
    // Tabbing forward off the last focusable wraps back to the first (the × button).
    last.focus()
    await user.tab()
    expect(document.activeElement).toBe(close)
  })

  it('restores focus to the opener on close', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="X">
            <button>inner</button>
          </Modal>
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'open' })
    opener.focus()
    await user.click(opener)
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
