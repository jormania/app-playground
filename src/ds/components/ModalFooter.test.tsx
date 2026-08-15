// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModalFooter } from './ModalFooter'

afterEach(cleanup)

/** The save button, whichever of its two stacked labels is showing. */
function saveButton() {
  return screen.getAllByRole('button').find(b => b.textContent?.includes('Saving...'))!
}

describe('ModalFooter', () => {
  it('renders Cancel and Save, and Delete only when there is something to delete', () => {
    const { rerender } = render(<ModalFooter onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull()

    rerender(<ModalFooter onCancel={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
  })

  it('keeps both save labels mounted so the button cannot change width mid-save', () => {
    // Swapping the text outright made the button grow the instant you pressed
    // it — "Saving..." is wider than "Save" — and that extra width was enough
    // to reflow the whole footer onto two lines while the save was in flight.
    const { rerender } = render(<ModalFooter onCancel={vi.fn()} saveLabel="Save" />)
    const btn = saveButton()
    expect(btn.textContent).toContain('Save')
    expect(btn.textContent).toContain('Saving...')

    rerender(<ModalFooter onCancel={vi.fn()} saveLabel="Save" isSaving />)
    // Same node, same two labels: only which one is visible changed.
    expect(saveButton()).toBe(btn)
    expect(btn.textContent).toContain('Save')
    expect(btn.textContent).toContain('Saving...')
  })

  it('exposes only the label that applies to the accessibility tree', () => {
    const { rerender } = render(<ModalFooter onCancel={vi.fn()} saveLabel="Save changes" />)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()

    rerender(<ModalFooter onCancel={vi.fn()} saveLabel="Save changes" isSaving />)
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeTruthy()
  })

  it('disables every button while saving — including Cancel and Delete', () => {
    render(<ModalFooter onCancel={vi.fn()} onDelete={vi.fn()} isSaving />)
    for (const btn of screen.getAllByRole('button')) {
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('submits the surrounding form when given no onSave', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(<form onSubmit={onSubmit}><ModalFooter onCancel={vi.fn()} /></form>)

    await user.click(saveButton())
    expect(onSubmit).toHaveBeenCalled()
  })

  it('calls onSave instead when one is given', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ModalFooter onCancel={vi.fn()} onSave={onSave} />)

    await user.click(saveButton())
    expect(onSave).toHaveBeenCalled()
  })
})
