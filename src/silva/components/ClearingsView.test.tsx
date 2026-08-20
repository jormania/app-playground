// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClearingsView } from './ClearingsView'
import type { Thing } from '../lib/notion'
import type { Locus } from '../lib/loci'

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

const solitude: Locus = { id: 'l1', name: 'Solitude', meaning: 'Being alone on purpose', coined: '2026-02-02' }
const waiting: Locus = { id: 'l2', name: 'Waiting', meaning: '', coined: '2026-03-03' }

const handlers = {
  onCoin: vi.fn(),
  onRename: vi.fn(),
  onAddThings: vi.fn(),
  onRemoveThing: vi.fn(),
  onMerge: vi.fn(),
  onDissolve: vi.fn(),
  onSplit: vi.fn(),
}

function renderView(things: Thing[], loci: Locus[], over: Partial<typeof handlers> = {}) {
  const props = { ...handlers, ...over }
  render(<ClearingsView things={things} loci={loci} {...props} />)
  return props
}

describe('ClearingsView', () => {
  it('names what a clearing is for when there are none yet', () => {
    renderView([thing('a')], [])
    expect(screen.getByText(/once a few kept things feel like they belong together/i)).toBeTruthy()
  })

  it('counts only the things actually in each clearing', () => {
    renderView([thing('a', { lociIds: ['l1'] }), thing('b')], [solitude])
    expect(screen.getByText(/1 thing →/)).toBeTruthy()
  })

  // "compost, not debt" (SILVA.md): once a member is released — or sent
  // back to the nursery — it has left the collection, and a clearing that
  // still counts or lists it is exactly the debt that rule exists to avoid.
  it('drops a released member from the count and the member list', async () => {
    const user = userEvent.setup()
    renderView(
      [thing('a', { lociIds: ['l1'] }), thing('b', { lociIds: ['l1'], state: 'Released' })],
      [solitude],
    )
    expect(screen.getByText(/1 thing →/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    expect(screen.getByText(/body of a/)).toBeTruthy()
    expect(screen.queryByText(/body of b/)).toBeNull()
  })

  it('drops a member returned to the nursery the same way', () => {
    renderView(
      [thing('a', { lociIds: ['l1'] }), thing('b', { lociIds: ['l1'], state: 'Understory', kept: null })],
      [solitude],
    )
    expect(screen.getByText(/1 thing →/)).toBeTruthy()
  })

  // SILVA.md's hard rule: "A locus can never be assigned at capture time.
  // The UI must not offer it." Coining is therefore always retrospective and
  // always here — and its seeds can only be things already kept.
  it('coins a clearing from things that are already kept', async () => {
    const user = userEvent.setup()
    const onCoin = vi.fn()
    renderView([thing('a'), thing('b', { state: 'Understory', kept: null })], [], { onCoin })

    await user.click(screen.getByRole('button', { name: /coin a new clearing/i }))
    // Only the kept thing is offered as a seed.
    expect(screen.getByText(/body of a/)).toBeTruthy()
    expect(screen.queryByText(/body of b/)).toBeNull()

    await user.type(screen.getByLabelText(/what do you call this clearing/i), 'Solitude')
    await user.type(screen.getByLabelText(/what you meant by it/i), 'Being alone on purpose')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /coin this clearing/i }))

    expect(onCoin).toHaveBeenCalledWith('Solitude', 'Being alone on purpose', ['a'])
  })

  it('will not coin a nameless clearing', async () => {
    const user = userEvent.setup()
    renderView([thing('a')], [])
    await user.click(screen.getByRole('button', { name: /coin a new clearing/i }))
    expect(screen.getByRole('button', { name: /coin this clearing/i }).hasAttribute('disabled')).toBe(true)
  })

  it('opens a clearing and shows what you meant by it', async () => {
    const user = userEvent.setup()
    renderView([thing('a', { lociIds: ['l1'] })], [solitude])
    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    expect(screen.getByRole('heading', { name: 'Solitude' })).toBeTruthy()
    expect(screen.getByText('Being alone on purpose')).toBeTruthy()
    expect(screen.getByText(/coined 2026-02-02/)).toBeTruthy()
  })

  it('renames a clearing without touching its members', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    renderView([thing('a', { lociIds: ['l1'] })], [solitude], { onRename })

    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText(/what do you call this clearing/i))
    await user.type(screen.getByLabelText(/what do you call this clearing/i), 'Being alone')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onRename).toHaveBeenCalledWith('l1', 'Being alone', 'Being alone on purpose')
  })

  it('removes a thing from a clearing', async () => {
    const user = userEvent.setup()
    const onRemoveThing = vi.fn()
    renderView([thing('a', { lociIds: ['l1'] })], [solitude], { onRemoveThing })
    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemoveThing).toHaveBeenCalledWith('l1', 'a')
  })

  // Splitting only makes sense once there is something to split.
  it('offers a split only from two members up', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ClearingsView things={[thing('a', { lociIds: ['l1'] })]} loci={[solitude]} {...handlers} />,
    )
    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    expect(screen.queryByRole('button', { name: /split this clearing/i })).toBeNull()

    rerender(
      <ClearingsView
        things={[thing('a', { lociIds: ['l1'] }), thing('b', { lociIds: ['l1'] })]}
        loci={[solitude]}
        {...handlers}
      />,
    )
    expect(screen.getByRole('button', { name: /split this clearing/i })).toBeTruthy()
  })

  it('splits chosen members into a newly named clearing', async () => {
    const user = userEvent.setup()
    const onSplit = vi.fn()
    renderView([thing('a', { lociIds: ['l1'] }), thing('b', { lociIds: ['l1'] })], [solitude], { onSplit })

    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    await user.click(screen.getByRole('button', { name: /split this clearing/i }))
    await user.click(screen.getAllByRole('checkbox')[1])
    await user.type(screen.getByLabelText(/what do you call the new clearing/i), 'Waiting')
    await user.click(screen.getByRole('button', { name: /split off 1 thing/i }))

    expect(onSplit).toHaveBeenCalledWith('l1', ['b'], 'Waiting', '')
  })

  it('offers a combine only when there is another clearing to combine with', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ClearingsView things={[]} loci={[solitude]} {...handlers} />)
    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    expect(screen.queryByText(/combine with another clearing/i)).toBeNull()

    rerender(<ClearingsView things={[]} loci={[solitude, waiting]} {...handlers} />)
    expect(screen.getByText(/combine with another clearing/i)).toBeTruthy()
  })

  // The direction matters and is easy to get backwards: the clearing you
  // *pick* survives; the one you are looking at is the one dissolved.
  it('combines into the chosen survivor, dissolving the one being viewed', async () => {
    const user = userEvent.setup()
    const onMerge = vi.fn()
    renderView([], [solitude, waiting], { onMerge })

    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    await user.selectOptions(screen.getByRole('combobox'), 'l2')
    await user.click(screen.getByRole('button', { name: 'Combine' }))
    // Destructive, so it goes through a confirm first.
    expect(onMerge).not.toHaveBeenCalled()
    await user.click(screen.getAllByRole('button', { name: 'Combine' }).pop()!)
    expect(onMerge).toHaveBeenCalledWith('l2', 'l1')
  })

  it('confirms before dissolving, and says the things themselves are safe', async () => {
    const user = userEvent.setup()
    const onDissolve = vi.fn()
    renderView([thing('a', { lociIds: ['l1'] })], [solitude], { onDissolve })

    await user.click(screen.getByRole('button', { name: /Solitude/ }))
    await user.click(screen.getByRole('button', { name: 'Dissolve' }))
    expect(onDissolve).not.toHaveBeenCalled()
    expect(screen.getByText(/nothing is lost/i)).toBeTruthy()

    // Two "Dissolve" buttons exist now — the section's and the confirm
    // dialog's. The dialog's is the last one in the document.
    await user.click(screen.getAllByRole('button', { name: 'Dissolve' }).pop()!)
    expect(onDissolve).toHaveBeenCalledWith('l1')
  })
})
