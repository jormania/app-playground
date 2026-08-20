// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NurseryView } from './NurseryView'
import type { Thing } from '../lib/notion'
import type { Source } from '../lib/sources'
import { todayIso } from '../lib/understory'
import { getLinkPreview } from '../lib/linkPreviewCache'

vi.mock('../lib/linkPreviewCache', () => ({ getLinkPreview: vi.fn() }))

afterEach(cleanup)

// Local calendar date, matching how the season is actually counted. Using
// `toISOString()` here made these tests pass in the evening and fail after
// local midnight — which is how the app's own UTC date stamps were found.
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return todayIso(d)
}

function arrival(id: string, encounteredDaysAgo: number, over: Partial<Thing> = {}): Thing {
  return {
    id,
    handle: id,
    body: `body of ${id}`,
    kind: null,
    state: 'Understory',
    sourceId: null,
    locator: '',
    encountered: daysAgo(encounteredDaysAgo),
    kept: null,
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
    arrived: null,
    ...over,
  }
}

describe('NurseryView', () => {
  it('names what lives here and the act that fills it when empty', () => {
    render(<NurseryView things={[]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/nursery is empty/i)).toBeTruthy()
  })

  it('renders each arrival with Keep and Release', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    const onRelease = vi.fn()
    render(<NurseryView things={[arrival('a', 1)]} onKeep={onKeep} onRelease={onRelease} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('a', undefined)
    await user.click(screen.getByRole('button', { name: 'Release' }))
    expect(onRelease).toHaveBeenCalledWith('a')
  })

  // SILVA.md's loop is Keep → Annotate — this is the annotate step arriving
  // early, at the moment of deciding, without making the one-tap Keep wait
  // on it. Collapsed by default so nothing changes for anyone who ignores it.
  it('keeps the one-tap Keep unless "+ Why" is opened', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    render(<NurseryView things={[arrival('a', 1)]} onKeep={onKeep} onRelease={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.queryByPlaceholderText(/why this/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('a', undefined)
  })

  it('carries a why typed before Keep into the keep itself', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    render(<NurseryView things={[arrival('a', 1)]} onKeep={onKeep} onRelease={vi.fn()} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Why' }))
    await user.type(screen.getByPlaceholderText(/why this/i), 'Rhymes with the tram passage')
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('a', 'Rhymes with the tram passage')
  })

  it('shows a photo\'s own thumbnail without needing to Keep it first', () => {
    const { container } = render(
      <NurseryView
        things={[arrival('a', 1, { kind: 'Image', image: 'https://files.notion.so/photo.jpg' })]}
        onKeep={vi.fn()}
        onRelease={vi.fn()} onDelete={vi.fn()}
      />,
    )
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.src).toBe('https://files.notion.so/photo.jpg')
  })

  it('shows a link\'s Open Graph image as the same kind of thumbnail', async () => {
    vi.mocked(getLinkPreview).mockResolvedValue({
      title: 'A Great Article', description: null, image: 'https://example.com/og.png', siteName: 'example.com', url: 'https://example.com/a',
    })
    const { container } = render(
      <NurseryView things={[arrival('a', 1, { kind: 'Link', link: 'https://example.com/a' })]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} />,
    )
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy())
    expect((container.querySelector('img') as HTMLImageElement).src).toBe('https://example.com/og.png')
  })

  // A photographed page whose transcription hasn't landed has an empty
  // body, so with a decorative alt the whole row carried no accessible
  // content at all — just two unexplained buttons.
  it('names a photographed page that has no transcription yet', () => {
    render(
      <NurseryView
        things={[arrival('a', 1, { kind: 'Image', body: '', image: 'https://files.notion.so/photo.jpg' })]}
        onKeep={vi.fn()}
        onRelease={vi.fn()} onDelete={vi.fn()}
      />,
    )
    expect(screen.getByAltText(/photographed page, not yet transcribed/i)).toBeTruthy()
  })

  it('leaves the thumbnail decorative once there are words to read', () => {
    const { container } = render(
      <NurseryView
        things={[arrival('a', 1, { kind: 'Image', image: 'https://files.notion.so/photo.jpg' })]}
        onKeep={vi.fn()}
        onRelease={vi.fn()} onDelete={vi.fn()}
      />,
    )
    expect((container.querySelector('img') as HTMLImageElement).alt).toBe('')
  })

  // Release is compost and needs no ceremony; delete is the sharp edge and
  // is the one action here that asks first.
  it('confirms before deleting, and distinguishes it from releasing', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const onRelease = vi.fn()
    render(<NurseryView things={[arrival('a', 1)]} onKeep={vi.fn()} onRelease={onRelease} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText(/never enters the collection at all/i)).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Delete' }).pop()!)
    expect(onDelete).toHaveBeenCalledWith('a')
    expect(onRelease).not.toHaveBeenCalled()
  })

  it('backs out of a delete without touching anything', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<NurseryView things={[arrival('a', 1)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('shows no thumbnail for an arrival with neither a photo nor a link', () => {
    const { container } = render(
      <NurseryView things={[arrival('a', 1)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(container.querySelector('img')).toBeNull()
  })

  it('never sends a blank why', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    render(<NurseryView things={[arrival('a', 1)]} onKeep={onKeep} onRelease={vi.fn()} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Why' }))
    await user.type(screen.getByPlaceholderText(/why this/i), '   ')
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('a', undefined)
  })

  // SILVA.md is explicit twice over: "No badge, no counter, no 'you have 284
  // items to process'", and the season is "shown as a fade rather than a
  // number." A countdown rendered into the row was a direct contradiction.
  it('shows the season as opacity, never as visible text', () => {
    render(<NurseryView things={[arrival('a', 45)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} seasonDays={90} />)
    const row = screen.getByRole('listitem')
    // Halfway through a 90-day season: 0.4 + 0.5 * 0.6 = 0.7
    expect(Number(row.style.opacity)).toBeCloseTo(0.7, 1)

    // No rendered text anywhere in the row states the count — the season is
    // carried by opacity plus the accessible name of a graphic bar.
    expect(row.textContent).not.toMatch(/\d+\s*days?/i)
    const bar = row.querySelector('[role="img"]')
    expect(bar).toBeTruthy()
    expect(bar!.getAttribute('aria-label')).toMatch(/\d+ days of this season left/i)
  })

  it('fades further as the season runs down', () => {
    const { rerender } = render(
      <NurseryView things={[arrival('a', 1)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} seasonDays={90} />,
    )
    const fresh = Number(screen.getByRole('listitem').style.opacity)
    rerender(<NurseryView things={[arrival('a', 85)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} seasonDays={90} />)
    expect(Number(screen.getByRole('listitem').style.opacity)).toBeLessThan(fresh)
  })

  // …but the fact itself is still available to anyone who can't perceive an
  // opacity. Withholding it from a screen reader would be an accessibility
  // bug wearing a design principle's clothes.
  it('still exposes the remaining season to assistive tech', () => {
    render(<NurseryView things={[arrival('a', 80)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} seasonDays={90} />)
    expect(screen.getByLabelText(/10 days of this season left/i)).toBeTruthy()
  })

  it('honours a shorter configured season', () => {
    render(<NurseryView things={[arrival('a', 20)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} seasonDays={30} />)
    expect(screen.getByLabelText(/10 days of this season left/i)).toBeTruthy()
  })

  it('never shows a negative season for something already past its date', () => {
    render(<NurseryView things={[arrival('a', 200)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} seasonDays={90} />)
    expect(screen.getByLabelText(/fading out of the nursery/i)).toBeTruthy()
  })
})

/**
 * A Kobo import lands a whole season's reading in the nursery at once. Three
 * hundred rows in one flat, fading list is not something anyone decides
 * about — which book am I even in? Grouping is presentation only: no field
 * is set, no source assigned, nothing reordered inside a section.
 */
describe('NurseryView — gathered by book', () => {
  const meditations: Source = {
    id: 's1', title: 'Meditations', author: 'Marcus Aurelius', kind: 'Book',
    cover: null, koboVolumeId: null, notes: '',
  }
  const odyssey: Source = {
    id: 's2', title: 'The Odyssey', author: 'Homer', kind: 'Book',
    cover: null, koboVolumeId: null, notes: '',
  }

  it('heads each book with its title, author and count', () => {
    render(
      <NurseryView
        things={[arrival('a', 1, { sourceId: 's1' }), arrival('b', 1, { sourceId: 's1' }), arrival('c', 1, { sourceId: 's2' })]}
        sources={[meditations, odyssey]}
        onKeep={vi.fn()}
        onRelease={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: /Meditations/ }).textContent).toContain('Marcus Aurelius')
    expect(screen.getByRole('heading', { name: /Meditations/ }).textContent).toContain('2 things')
    expect(screen.getByRole('heading', { name: /Odyssey/ }).textContent).toContain('1 thing')
  })

  // A heading over a single untitled section is noise, so a nursery of typed
  // captures stays exactly the list it always was.
  it('adds no headings at all when nothing here has a source', () => {
    render(<NurseryView things={[arrival('a', 1), arrival('b', 2)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  // Your own captures are why you opened the nursery — they don't get pushed
  // below an import of somebody else's book.
  it('leaves your own unsourced captures unheaded, and first', () => {
    render(
      <NurseryView
        things={[arrival('imported', 1, { sourceId: 's1' }), arrival('mine', 1)]}
        sources={[meditations]}
        onKeep={vi.fn()}
        onRelease={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    const headings = screen.getAllByRole('heading')
    expect(headings).toHaveLength(1)
    const rendered = screen.getByText('body of mine')
    const firstHeading = headings[0]
    // The unsourced row comes before the first book heading in document order.
    expect(rendered.compareDocumentPosition(firstHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('still keeps every row\'s actions working inside a section', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    render(
      <NurseryView
        things={[arrival('a', 1, { sourceId: 's1' })]}
        sources={[meditations]}
        onKeep={onKeep}
        onRelease={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('a', undefined)
  })
})

/**
 * A Link thing's row is often the bare pasted URL right up until Keep gives
 * it the article's title — exactly the moment "what even is this" is a real
 * question the text alone can't answer. Made clickable here so it doesn't
 * have to stay one.
 */
describe('NurseryView — a Link thing is clickable', () => {
  it('renders the body as a real link to thing.link', () => {
    render(
      <NurseryView
        things={[arrival('a', 1, { link: 'https://nesslabs.com/jomo', body: 'https://nesslabs.com/jomo' })]}
        onKeep={vi.fn()}
        onRelease={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    const link = screen.getByRole('link', { name: 'https://nesslabs.com/jomo' })
    expect(link.getAttribute('href')).toBe('https://nesslabs.com/jomo')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  // Everything that isn't a Link thing renders exactly as before — plain
  // text, no anchor.
  it('leaves a thing with no link as plain text', () => {
    render(<NurseryView things={[arrival('a', 1)]} onKeep={vi.fn()} onRelease={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('body of a')).toBeTruthy()
  })

  // Keep/Release/Delete sit right beside the link text in the same row —
  // a tap on the link must never also register as a tap on the row.
  it('does not fire Keep when the link itself is clicked', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    render(
      <NurseryView
        things={[arrival('a', 1, { link: 'https://example.com', body: 'https://example.com' })]}
        onKeep={onKeep}
        onRelease={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('link'))
    expect(onKeep).not.toHaveBeenCalled()
  })
})
