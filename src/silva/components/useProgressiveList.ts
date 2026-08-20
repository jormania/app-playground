import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * How many plates the Forest mounts before you have scrolled anywhere, and
 * how many more each time you reach the end. A screenful is a handful, so
 * this is generous enough that the growth is never the thing you notice.
 */
export const FOREST_PAGE_SIZE = 20

/**
 * Renders a long list a window at a time, growing as the reader reaches the
 * end of what is mounted.
 *
 * ── Why this is the *rendering* layer and not the data layer ────────────
 * Paging the data — fetching twenty things and asking Notion for more on
 * scroll — would break Silva outright: the walk weights every kept thing by
 * neglect, Forage searches all of them, provocations look for tension
 * anywhere, and the crossing draws the whole graph. A thing you have not
 * scrolled to must still be a thing the walk can offer you tomorrow. So the
 * collection stays whole in memory (and now comes from a local mirror, see
 * lib/collectionCache.ts) and only the *DOM* is paged.
 *
 * That distinction is what makes this safe, and it's where the real cost
 * was anyway. A `SpecimenPlate` is not a cheap row: it carries a
 * neighbourhood panel that scans the collection for near things, an
 * expandable body, a dwell observer, and a link preview. Mounting one per
 * kept thing means all of that happens for a passage sitting ten thousand
 * pixels below the fold, on every render. Mounting a window means the work
 * tracks what is being read rather than what has ever been kept.
 *
 * ── Why an IntersectionObserver and not a scroll handler ────────────────
 * A scroll listener fires continuously and has to measure the document to
 * decide anything. An observer fires once, when a sentinel element below
 * the last plate actually comes into view, and costs nothing while it
 * doesn't. It also degrades honestly: where there is no observer (an older
 * browser, a test environment) `showAll` below is the escape hatch.
 */
export function useProgressiveList<T>(
  items: T[],
  pageSize: number = FOREST_PAGE_SIZE,
): {
  visible: T[]
  hasMore: boolean
  /** Attach to an element rendered *after* the last visible item. */
  sentinelRef: (node: HTMLElement | null) => void
} {
  const [count, setCount] = useState(pageSize)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // A changed collection starts the window over — keeping a grown count
  // across a switch to a much shorter list would mount everything at once,
  // which is the situation this exists to avoid.
  useEffect(() => {
    setCount(pageSize)
  }, [items, pageSize])

  const hasMore = count < items.length

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect()
      if (!node) return
      if (typeof IntersectionObserver === 'undefined') {
        // No observer to lean on: show the rest rather than stranding the
        // reader at an invisible boundary they cannot scroll past.
        setCount(items.length)
        return
      }
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setCount((current) => Math.min(current + pageSize, items.length))
          }
        },
        // A generous margin, so the next plates are mounted before the
        // reader arrives at the gap rather than after.
        { rootMargin: '600px' },
      )
      observerRef.current.observe(node)
    },
    [items.length, pageSize],
  )

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return { visible: items.slice(0, count), hasMore, sentinelRef }
}
