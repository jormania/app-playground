// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RootsView } from './RootsView'
import type { Thing } from '../lib/notion'
import type { Source } from '../lib/sources'

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
    ...over,
  }
}

function source(id: string, over: Partial<Source> = {}): Source {
  return {
    id,
    title: id,
    author: '',
    kind: null,
    cover: null,
    koboVolumeId: null,
    notes: '',
    ...over,
  }
}

const handlers = {
  onEditThing: vi.fn(),
  onSeen: vi.fn(),
  onEditSource: vi.fn(),
}

function renderView(things: Thing[], sources: Source[], over: Partial<typeof handlers> = {}) {
  const props = { ...handlers, ...over }
  render(<RootsView things={things} sources={sources} loci={[]} {...props} />)
  return props
}

describe('RootsView', () => {
  it('names what fills it when nothing kept has a source yet', () => {
    renderView([thing('a')], [source('s1')])
    expect(screen.getByText(/nothing kept has a source yet/i)).toBeTruthy()
  })

  // A source only earns a place here once something kept actually points at
  // it — this is not a shelf you stock ahead of reading.
  it('only lists sources with at least one kept thing', () => {
    renderView(
      [thing('a', { sourceId: 's1' }), thing('b', { sourceId: 's2', state: 'Understory', kept: null })],
      [source('s1', { title: 'Meditations' }), source('s2', { title: 'Never kept from' })],
    )
    expect(screen.getByText('Meditations')).toBeTruthy()
    expect(screen.queryByText('Never kept from')).toBeNull()
  })

  it('counts only kept things from that source', () => {
    renderView(
      [thing('a', { sourceId: 's1' }), thing('b', { sourceId: 's1' }), thing('c', { sourceId: 's1', state: 'Released' })],
      [source('s1', { title: 'Meditations' })],
    )
    expect(screen.getByText(/2 things →/)).toBeTruthy()
  })

  it('opens a source and reads its passages in locator order', async () => {
    const user = userEvent.setup()
    renderView(
      [
        thing('late', { sourceId: 's1', locator: 'p. 200', body: 'the late passage' }),
        thing('early', { sourceId: 's1', locator: 'p. 5', body: 'the early passage' }),
      ],
      [source('s1', { title: 'Meditations', author: 'Marcus Aurelius' })],
    )
    await user.click(screen.getByRole('button', { name: /Meditations/ }))
    expect(screen.getByRole('heading', { name: 'Meditations' })).toBeTruthy()
    expect(screen.getByText(/Marcus Aurelius/)).toBeTruthy()

    const bodies = screen.getAllByText(/the (early|late) passage/).map((n) => n.textContent)
    expect(bodies).toEqual(['the early passage', 'the late passage'])
  })

  it('saves an edited source, author included', async () => {
    const user = userEvent.setup()
    const onEditSource = vi.fn()
    renderView(
      [thing('a', { sourceId: 's1' })],
      [source('s1', { title: 'Meditations', author: 'Marcus Aurelius' })],
      { onEditSource },
    )
    await user.click(screen.getByRole('button', { name: /Meditations/ }))
    await user.click(screen.getByRole('button', { name: 'Edit source' }))
    await user.clear(screen.getByLabelText('Author'))
    await user.type(screen.getByLabelText('Author'), 'M. Aurelius')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onEditSource).toHaveBeenCalledWith('s1', { title: 'Meditations', author: 'M. Aurelius', kind: null, notes: '' })
  })

  // The title used to be locked at creation time — fixed, since it's as
  // correctable as anything else about a source (a typo, a translation's
  // subtitle, a title Kobo got wrong).
  it('lets the title itself be corrected', async () => {
    const user = userEvent.setup()
    const onEditSource = vi.fn()
    renderView(
      [thing('a', { sourceId: 's1' })],
      [source('s1', { title: 'Meditaitons' })],
      { onEditSource },
    )
    await user.click(screen.getByRole('button', { name: /Meditaitons/ }))
    await user.click(screen.getByRole('button', { name: 'Edit source' }))
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Meditations')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onEditSource).toHaveBeenCalledWith('s1', { title: 'Meditations', author: '', kind: null, notes: '' })
  })

  it('will not save a blanked-out title', async () => {
    const user = userEvent.setup()
    renderView([thing('a', { sourceId: 's1' })], [source('s1', { title: 'Meditations' })])
    await user.click(screen.getByRole('button', { name: /Meditations/ }))
    await user.click(screen.getByRole('button', { name: 'Edit source' }))
    await user.clear(screen.getByLabelText('Title'))
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true)
  })
})
