// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PathsView } from './PathsView'
import type { Thing } from '../lib/notion'
import type { Path } from '../lib/paths'

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

const path: Path = {
  id: 'p1',
  label: 'a → b',
  fromId: 'a',
  toId: 'b',
  why: 'Both are about waiting.',
  made: '2026-04-04',
  origin: 'Accepted',
}

const handlers = { onMake: vi.fn(), onEditWhy: vi.fn(), onRemove: vi.fn() }
// The graph is off in these tests: they are about the path list and its
// forms, and rendering the SVG would only add noise.
const base = { loci: [], vectorsById: new Map<string, Float32Array>(), showGraph: false }

describe('PathsView', () => {
  it('cannot walk a path until two things are kept', () => {
    render(<PathsView {...base} things={[thing('a')]} paths={[]} {...handlers} />)
    expect(screen.getByRole('button', { name: /walk a new path/i }).hasAttribute('disabled')).toBe(true)
  })

  // The two empty states used to say the same thing twice, in two different
  // voices, on either side of the action button. One view, one empty state.
  it('says what a path is for while there are none', () => {
    render(<PathsView {...base} things={[thing('a'), thing('b')]} paths={[]} {...handlers} />)
    expect(screen.getByText(/no paths yet/i)).toBeTruthy()
    expect(screen.getByText(/say why/i)).toBeTruthy()
  })

  // SILVA.md: "a path without its Why is precisely the artefact we are
  // trying not to build." Both ends and a why, or no path.
  it('requires two distinct things and a why before a path can be walked', async () => {
    const user = userEvent.setup()
    const onMake = vi.fn()
    render(<PathsView {...base} things={[thing('a'), thing('b')]} paths={[]} {...handlers} onMake={onMake} />)

    await user.click(screen.getByRole('button', { name: /walk a new path/i }))
    const walk = screen.getByRole('button', { name: /walk this path/i })
    const [from, to] = screen.getAllByRole('combobox')

    await user.selectOptions(from, 'a')
    expect(walk.hasAttribute('disabled')).toBe(true)

    await user.selectOptions(to, 'b')
    expect(walk.hasAttribute('disabled')).toBe(true)

    await user.type(screen.getByLabelText(/what did you see between them/i), 'Both are about waiting.')
    expect(screen.getByRole('button', { name: /walk this path/i }).hasAttribute('disabled')).toBe(false)

    await user.click(screen.getByRole('button', { name: /walk this path/i }))
    expect(onMake).toHaveBeenCalledWith('a', 'b', 'Both are about waiting.')
  })

  it('will not let one thing be both ends of a path', async () => {
    const user = userEvent.setup()
    render(<PathsView {...base} things={[thing('a'), thing('b')]} paths={[]} {...handlers} />)
    await user.click(screen.getByRole('button', { name: /walk a new path/i }))
    const [from, to] = screen.getAllByRole('combobox')
    await user.selectOptions(from, 'a')
    const sameInTo = [...(to as HTMLSelectElement).options].find((o) => o.value === 'a')!
    expect(sameInTo.disabled).toBe(true)
  })

  it('shows a walked path with its why, its origin and when it was made', () => {
    render(
      <PathsView {...base} things={[thing('a'), thing('b')]} paths={[path]} {...handlers} />,
    )
    expect(screen.getByText('Both are about waiting.')).toBeTruthy()
    expect(screen.getByText('Accepted')).toBeTruthy()
    expect(screen.getByText(/made 2026-04-04/)).toBeTruthy()
  })

  // Deleting a thing in Notion shouldn't make the path list crash or lie.
  it('survives a path whose ends are no longer in the collection', () => {
    render(<PathsView {...base} things={[]} paths={[path]} {...handlers} />)
    expect(screen.getAllByText('(no longer here)')).toHaveLength(2)
  })

  // The bug this exists for: a released end used to still render its full
  // passage here, even though the graph right above it (Kept-only) had
  // already made that same thing's node vanish — one view giving two
  // different answers about whether the thing was still part of the
  // collection. Released must read exactly like actually-gone.
  it('treats a released end the same as one no longer in the collection', () => {
    render(
      <PathsView
        {...base}
        things={[thing('a', { state: 'Released' }), thing('b')]}
        paths={[path]}
        {...handlers}
      />,
    )
    expect(screen.getByText('(no longer here)')).toBeTruthy()
    expect(screen.queryByText('body of a')).toBeNull()
    expect(screen.getByText('body of b')).toBeTruthy()
  })

  it('edits a why and can be cancelled without saving', async () => {
    const user = userEvent.setup()
    const onEditWhy = vi.fn()
    render(<PathsView {...base} things={[thing('a'), thing('b')]} paths={[path]} {...handlers} onEditWhy={onEditWhy} />)

    await user.click(screen.getByRole('button', { name: /edit why/i }))
    await user.clear(screen.getByLabelText(/what did you see between them/i))
    await user.type(screen.getByLabelText(/what did you see between them/i), 'Actually, about patience.')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onEditWhy).toHaveBeenCalledWith('p1', 'Actually, about patience.')

    await user.click(screen.getByRole('button', { name: /edit why/i }))
    await user.clear(screen.getByLabelText(/what did you see between them/i))
    await user.type(screen.getByLabelText(/what did you see between them/i), 'nonsense')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onEditWhy).toHaveBeenCalledTimes(1)
  })

  it('confirms before removing a path, and says the two things are untouched', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<PathsView {...base} things={[thing('a'), thing('b')]} paths={[path]} {...handlers} onRemove={onRemove} />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).not.toHaveBeenCalled()
    expect(screen.getByText(/the two things it connects are never affected/i)).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Remove' }).pop()!)
    expect(onRemove).toHaveBeenCalledWith('p1')
  })
})
