// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForageView } from './ForageView'
import type { Thing } from '../lib/notion'
import type { Source } from '../lib/sources'

// The semantic half of Forage loads a ~25 MB model. These tests are about
// the view's own behaviour — what it lists, what it hides, what you can do
// with a result — so the index resolves empty and matching stays lexical.
vi.mock('../lib/indexer', () => ({
  indexThings: vi.fn(async () => new Map()),
  indexableThings: (things: Thing[]) => things,
}))
vi.mock('../lib/embeddings', () => ({
  embed: vi.fn(async () => new Float32Array([1, 0])),
  cosineSimilarity: () => 0,
  contentHash: (s: string) => s,
}))

afterEach(cleanup)

function thing(id: string, over: Partial<Thing> = {}): Thing {
  return {
    id,
    handle: id,
    body: `body of ${id}`,
    kind: null,
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: '2026-01-01',
    kept: '2026-01-02',
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
    arrived: null,
    ...over,
  }
}

function source(id: string, title: string): Source {
  return { id, title, author: '', kind: null, cover: null, koboVolumeId: null, notes: '' }
}

function renderView(things: Thing[], sources: Source[] = []) {
  return render(<ForageView things={things} sources={sources} vectorsById={new Map()} />)
}

describe('ForageView', () => {
  it('shows nothing until you actually ask for something', () => {
    renderView([thing('a')])
    expect(screen.queryByText(/body of a/)).toBeNull()
  })

  it('finds a thing by its words', async () => {
    const user = userEvent.setup()
    renderView([thing('a', { body: 'a dog at the tram stop' }), thing('b', { body: 'something else' })])

    await user.type(screen.getByRole('textbox'), 'tram')
    await waitFor(() => expect(screen.getByText(/a dog at the tram stop/)).toBeTruthy())
    expect(screen.queryByText(/something else/)).toBeNull()
  })

  // SILVA.md's "compost, not debt": something you let go has left the
  // collection, and a box that keeps digging it back up is the opposite.
  it('never digs up a released thing', async () => {
    const user = userEvent.setup()
    renderView([
      thing('kept', { body: 'a kept tram passage' }),
      thing('gone', { body: 'a released tram passage', state: 'Released' }),
    ])

    await user.type(screen.getByRole('textbox'), 'tram')
    await waitFor(() => expect(screen.getByText(/a kept tram passage/)).toBeTruthy())
    expect(screen.queryByText(/a released tram passage/)).toBeNull()
  })

  // The dead end this fixes: a result was truncated at 140 characters with
  // nothing to click, so you could find the thing you were looking for and
  // still not be able to read it.
  it('lets a long result be read in place rather than sending you to the Forest', async () => {
    const user = userEvent.setup()
    const long = `tram ${'x'.repeat(400)}`
    renderView([thing('a', { body: long })])

    await user.type(screen.getByRole('textbox'), 'tram')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.getByText(long)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy()
  })

  it('offers no expand toggle for a result short enough to already be whole', async () => {
    const user = userEvent.setup()
    renderView([thing('a', { body: 'a short tram note' })])

    await user.type(screen.getByRole('textbox'), 'tram')
    await waitFor(() => expect(screen.getByText('a short tram note')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  it('narrows by kind with no query at all', async () => {
    const user = userEvent.setup()
    renderView([thing('q', { kind: 'Question' }), thing('p', { kind: 'Passage' })])

    await user.click(screen.getByRole('button', { name: 'Question' }))
    await waitFor(() => expect(screen.getByText(/body of q/)).toBeTruthy())
    expect(screen.queryByText(/body of p/)).toBeNull()
  })

  // A dropdown that can only ever say "Every source" is noise.
  it('offers a source filter only once there are two sources to choose between', () => {
    const oneSource = [thing('a', { sourceId: 's1' })]
    const { rerender } = renderView(oneSource, [source('s1', 'Meditations')])
    expect(screen.queryByRole('combobox')).toBeNull()

    rerender(
      <ForageView
        things={[thing('a', { sourceId: 's1' }), thing('b', { sourceId: 's2' })]}
        sources={[source('s1', 'Meditations'), source('s2', 'The Civil War')]}
        vectorsById={new Map()}
      />,
    )
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('says plainly when a search found nothing', async () => {
    const user = userEvent.setup()
    renderView([thing('a', { body: 'nothing relevant here' })])

    await user.type(screen.getByRole('textbox'), 'zzzzz')
    await waitFor(() => expect(screen.getByText(/Nothing found for "zzzzz"/)).toBeTruthy())
  })
})
