// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Neighbourhood } from './Neighbourhood'
import type { Thing } from '../lib/notion'
import type { Path } from '../lib/paths'

afterEach(cleanup)

function thing(id: string, patch: Partial<Thing> = {}): Thing {
  return {
    id, handle: id, body: `body ${id}`, kind: null, state: 'Kept', sourceId: null,
    locator: '', encountered: '2026-01-01', kept: '2026-01-01', note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, arrived: null, ...patch,
  }
}

function path(id: string, fromId: string, toId: string): Path {
  return { id, label: `${fromId} → ${toId}`, fromId, toId, why: 'because', made: '2026-01-01', origin: 'Yours' }
}

/**
 * "Show the crossing" hides the crossing (Paths) and the rootstock (Roots)
 * — the same picture at whole-forest scale — and, since this is the
 * identical drawing at one-thing scale, hides this panel's own small
 * node-link graph too when opened. Everything else (the toggle, the counts,
 * "Paths you walked", "Grew near this", "Walk a path") is the make-a-path
 * form, not the drawing, and stays regardless of the setting.
 */
describe('Neighbourhood — showGraph', () => {
  const self = thing('me')
  const other = thing('other')
  const things = [self, other]
  const paths = [path('p1', 'me', 'other')]

  it('draws the graph once opened, by default', async () => {
    const user = userEvent.setup()
    render(<Neighbourhood thing={self} things={things} paths={paths} vectorsById={new Map()} onMakePath={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /near this/i }))
    expect(screen.getByRole('img', { name: /this thing/i })).toBeTruthy()
  })

  it('hides only the drawing when showGraph is false, leaving the lists', async () => {
    const user = userEvent.setup()
    render(
      <Neighbourhood
        thing={self}
        things={things}
        paths={paths}
        vectorsById={new Map()}
        onMakePath={vi.fn()}
        showGraph={false}
      />,
    )
    await user.click(screen.getByRole('button', { name: /near this/i }))
    expect(screen.queryByRole('img', { name: /this thing/i })).toBeNull()
    // The make-a-path form itself — untouched by the setting.
    expect(screen.getByText('Paths you walked')).toBeTruthy()
  })

  it('still lets a path be made with the graph off', async () => {
    const user = userEvent.setup()
    const onMakePath = vi.fn()
    const near = thing('near-1')
    render(
      <Neighbourhood
        thing={self}
        things={[self, near]}
        paths={[]}
        vectorsById={new Map([['me', new Float32Array([1, 0])], ['near-1', new Float32Array([1, 0])]])}
        onMakePath={onMakePath}
        showGraph={false}
      />,
    )
    await user.click(screen.getByRole('button', { name: /near this/i }))
    await user.click(screen.getByRole('button', { name: /walk a path/i }))
    await user.type(screen.getByLabelText(/what did you see between them/i), 'the same idea')
    await user.click(screen.getByRole('button', { name: /walk this path/i }))
    expect(onMakePath).toHaveBeenCalledWith('me', 'near-1', 'the same idea')
  })
})
