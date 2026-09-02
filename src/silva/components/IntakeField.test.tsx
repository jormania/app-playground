// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IntakeField } from './IntakeField'
import type { Source } from '../lib/sources'

afterEach(cleanup)

function source(over: Partial<Source> = {}): Source {
  return {
    id: 's1',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    kind: 'Book',
    cover: null,
    koboVolumeId: null,
    notes: '',
    ...over,
  }
}

describe('IntakeField — submitting', () => {
  it('passes the typed body, locator and source through on submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<IntakeField onSubmit={onSubmit} onPhoto={vi.fn()} />)

    await user.type(screen.getByLabelText(/type or paste/i), 'Something worth keeping.')
    await user.type(screen.getByLabelText(/where did you encounter/i), 'Meditations by Marcus Aurelius')
    await user.click(screen.getByRole('button', { name: 'Add to the nursery' }))

    expect(onSubmit).toHaveBeenCalledWith('Something worth keeping.', '', 'Meditations by Marcus Aurelius')
  })
})

/**
 * A source-field autocomplete, so retyping "Meditations" a fourth time
 * completes it rather than risking a slightly different string that reads
 * as a new book to `resolveSource`'s similarity check.
 */
describe('IntakeField — source autocomplete', () => {
  it('offers existing sources as datalist options', () => {
    render(<IntakeField onSubmit={vi.fn()} onPhoto={vi.fn()} sources={[source()]} />)
    const input = screen.getByLabelText(/where did you encounter/i) as HTMLInputElement
    const list = document.getElementById(input.getAttribute('list') || '')
    expect(list).toBeTruthy()
    expect(Array.from(list?.querySelectorAll('option') ?? []).map((o) => o.getAttribute('value'))).toEqual([
      'Meditations by Marcus Aurelius',
    ])
  })

  // The exact "Title by Author" shape SpecimenPlate's own edit screen reads
  // a source back into, so picking a suggestion round-trips through
  // `resolveSource` as an exact match rather than merely a close one.
  it('formats a suggestion the same way an existing source is edited', () => {
    render(
      <IntakeField
        onSubmit={vi.fn()}
        onPhoto={vi.fn()}
        sources={[source({ id: 's2', title: 'Silent Spring', author: 'Rachel Carson' })]}
      />,
    )
    expect(screen.getByText('Silent Spring by Rachel Carson')).toBeTruthy()
  })

  it('drops the "by" for a source with no author', () => {
    render(<IntakeField onSubmit={vi.fn()} onPhoto={vi.fn()} sources={[source({ author: '' })]} />)
    expect(screen.getByText('Meditations')).toBeTruthy()
  })

  it('de-duplicates two sources that share a display string', () => {
    render(
      <IntakeField
        onSubmit={vi.fn()}
        onPhoto={vi.fn()}
        sources={[source({ id: 's1' }), source({ id: 's2' })]}
      />,
    )
    const input = screen.getByLabelText(/where did you encounter/i) as HTMLInputElement
    const list = document.getElementById(input.getAttribute('list') || '')
    expect(list?.querySelectorAll('option').length).toBe(1)
  })

  // Nothing to suggest is nothing to wire up — the field degrades to
  // exactly the plain text input it always was.
  it('has no list attribute at all when there are no sources', () => {
    render(<IntakeField onSubmit={vi.fn()} onPhoto={vi.fn()} />)
    expect(screen.getByLabelText(/where did you encounter/i).hasAttribute('list')).toBe(false)
    expect(document.querySelector('datalist')).toBeNull()
  })
})

describe('IntakeField — a link already in the forest', () => {
  it('says so without standing in the way of the capture', async () => {
    const onSubmit = vi.fn()
    render(
      <IntakeField
        onSubmit={onSubmit}
        onPhoto={vi.fn()}
        prefill={{ body: 'https://example.com/essay', locator: '' }}
        notice="You already have this — grown 2026-08-18."
      />,
    )
    expect(screen.getByText('You already have this — grown 2026-08-18.')).toBeTruthy()

    const add = screen.getByRole('button', { name: /add to the nursery/i })
    expect(add.hasAttribute('disabled')).toBe(false)
    await userEvent.click(add)
    expect(onSubmit).toHaveBeenCalledWith('https://example.com/essay', '', '')
  })

  it('says nothing at all when there is nothing to say', () => {
    render(<IntakeField onSubmit={vi.fn()} onPhoto={vi.fn()} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
