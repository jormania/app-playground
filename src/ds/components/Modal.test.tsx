// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { useEffect, useState } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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

  // The contract the two-pass mount used to break. A parent that opens the
  // dialog and then reaches into its content from an effect keyed on the same
  // flag runs on this commit — if the children aren't here yet it finds
  // nothing, and (as Cabinet's QR canvas proved) can fail without a sound.
  describe('mounts its children on the commit `open` flips true', () => {
    it('has run a child callback ref by the time the opening click settles', async () => {
      const attached: (HTMLElement | null)[] = []

      function Harness() {
        const [open, setOpen] = useState(false)
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>open</button>
            <Modal open={open} onClose={() => setOpen(false)} title="Late">
              <span ref={(el) => { attached.push(el) }}>body</span>
            </Modal>
          </>
        )
      }

      render(<Harness />)
      expect(attached).toHaveLength(0)

      await userEvent.click(screen.getByRole('button', { name: 'open' }))
      expect(attached.filter(Boolean)).toHaveLength(1)
      expect(document.body.contains(attached.find(Boolean)!)).toBe(true)
    })

    it('exposes the dialog to an effect keyed on the same flag that opened it', async () => {
      const seen: (Element | null)[] = []

      function Harness() {
        const [open, setOpen] = useState(false)
        useEffect(() => {
          if (!open) return
          seen.push(document.querySelector('[role="dialog"] .probe'))
        }, [open])
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>open</button>
            <Modal open={open} onClose={() => setOpen(false)} title="Late">
              <span className="probe">body</span>
            </Modal>
          </>
        )
      }

      render(<Harness />)
      await userEvent.click(screen.getByRole('button', { name: 'open' }))
      expect(seen).toHaveLength(1)
      expect(seen[0]).not.toBeNull()
    })
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
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(document.activeElement).toBe(opener)
  })

  it('Escape closes only the topmost modal when dialogs are nested', async () => {
    // Dialogs.tsx ships nested dialogs as a first-class pattern (a ConfirmModal rendered
    // inside an open Modal), but every Modal listened for Escape on `document` with no
    // notion of which was on top — so one Escape fired every listener and tore down the
    // whole stack, discarding the panel the user was working in along with the
    // confirmation they were dismissing.
    const user = userEvent.setup()

    function Harness() {
      const [outer, setOuter] = useState(true)
      const [inner, setInner] = useState(true)
      return (
        <>
          <Modal open={outer} onClose={() => setOuter(false)} title="Outer">
            <button>outer body</button>
            <Modal open={inner} onClose={() => setInner(false)} title="Inner">
              <button>inner body</button>
            </Modal>
          </Modal>
        </>
      )
    }

    render(<Harness />)
    expect(screen.getAllByRole('dialog')).toHaveLength(2)

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('Inner')).toBeNull()
    })
    // The outer modal survives the first Escape...
    expect(screen.getByText('Outer')).toBeTruthy()

    // ...and closes on the second, now that it is topmost.
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('does not re-grab focus when the parent re-renders with a new onClose identity', async () => {
    // Consumers pass inline arrows, so onClose changes identity on every parent render.
    // With onClose in the focus effect's dependency array, each of those re-ran the
    // effect — restoring and re-taking focus — which yanked the caret out of whatever
    // field the user was typing in.
    function Harness() {
      const [, setTick] = useState(0)
      return (
        <>
          <button onClick={() => setTick(t => t + 1)}>re-render</button>
          <Modal open onClose={() => {}} title="X">
            <input aria-label="field" />
          </Modal>
        </>
      )
    }

    render(<Harness />)
    const field = screen.getByLabelText('field')
    field.focus()
    expect(document.activeElement).toBe(field)

    // Re-render the parent without closing the modal.
    act(() => {
      screen.getByRole('button', { name: 're-render' }).click()
    })

    expect(document.activeElement).toBe(field)
  })
})
