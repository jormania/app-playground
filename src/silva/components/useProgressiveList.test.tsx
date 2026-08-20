// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useProgressiveList, FOREST_PAGE_SIZE } from './useProgressiveList'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Harness({ items }: { items: string[] }) {
  const { visible, hasMore, sentinelRef } = useProgressiveList(items)
  return (
    <div>
      <span data-testid="count">{visible.length}</span>
      <span data-testid="more">{String(hasMore)}</span>
      {hasMore && <div data-testid="sentinel" ref={sentinelRef} />}
    </div>
  )
}

const items = (n: number) => Array.from({ length: n }, (_, i) => `item-${i}`)

describe('useProgressiveList', () => {
  it('mounts only the first page of a long list', () => {
    render(<Harness items={items(100)} />)
    expect(screen.getByTestId('count').textContent).toBe(String(FOREST_PAGE_SIZE))
    expect(screen.getByTestId('more').textContent).toBe('true')
  })

  // A short collection is the common case and must not grow a sentinel or
  // hide anything behind one.
  it('mounts a short list whole, with nothing more to come', () => {
    render(<Harness items={items(3)} />)
    expect(screen.getByTestId('count').textContent).toBe('3')
    expect(screen.getByTestId('more').textContent).toBe('false')
    expect(screen.queryByTestId('sentinel')).toBeNull()
  })

  it('grows by a page when the sentinel comes into view', () => {
    let trigger: ((entries: { isIntersecting: boolean }[]) => void) | null = null
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { trigger = cb }
      observe() {}
      disconnect() {}
    })

    render(<Harness items={items(100)} />)
    expect(screen.getByTestId('count').textContent).toBe(String(FOREST_PAGE_SIZE))
    act(() => trigger?.([{ isIntersecting: true }]))
    expect(screen.getByTestId('count').textContent).toBe(String(FOREST_PAGE_SIZE * 2))
  })

  it('never grows past the end of the list', () => {
    let trigger: ((entries: { isIntersecting: boolean }[]) => void) | null = null
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { trigger = cb }
      observe() {}
      disconnect() {}
    })

    render(<Harness items={items(FOREST_PAGE_SIZE + 3)} />)
    act(() => trigger?.([{ isIntersecting: true }]))
    act(() => trigger?.([{ isIntersecting: true }]))
    expect(screen.getByTestId('count').textContent).toBe(String(FOREST_PAGE_SIZE + 3))
    expect(screen.getByTestId('more').textContent).toBe('false')
  })

  it('ignores a sentinel that is merely observed, not intersecting', () => {
    let trigger: ((entries: { isIntersecting: boolean }[]) => void) | null = null
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { trigger = cb }
      observe() {}
      disconnect() {}
    })

    render(<Harness items={items(100)} />)
    act(() => trigger?.([{ isIntersecting: false }]))
    expect(screen.getByTestId('count').textContent).toBe(String(FOREST_PAGE_SIZE))
  })

  // Without an observer there is no way to know the reader reached the end,
  // so showing everything beats stranding them at an invisible boundary.
  it('falls back to showing everything where there is no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Harness items={items(100)} />)
    expect(screen.getByTestId('count').textContent).toBe('100')
  })
})
