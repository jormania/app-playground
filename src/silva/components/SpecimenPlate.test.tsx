// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpecimenPlate } from './SpecimenPlate'
import type { Thing } from '../lib/notion'
import type { Source } from '../lib/sources'
import { getLinkPreview } from '../lib/linkPreviewCache'

vi.mock('../lib/linkPreviewCache', () => ({ getLinkPreview: vi.fn() }))

afterEach(cleanup)

function thing(over: Partial<Thing> = {}): Thing {
  return {
    id: 'a',
    handle: 'a',
    body: 'The thing itself',
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

const handlers = { onEdit: vi.fn(), onSeen: vi.fn() }

describe('SpecimenPlate — a photographed page', () => {
  it('renders a Notion-hosted photo directly, framed like a link card', () => {
    const { container } = render(<SpecimenPlate thing={thing({ image: 'https://files.notion.so/photo.jpg', body: '' })} {...handlers} />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.src).toBe('https://files.notion.so/photo.jpg')
  })
})

describe('SpecimenPlate — a link', () => {
  it('shows the plain host/path line while the preview is still loading', () => {
    vi.mocked(getLinkPreview).mockReturnValue(new Promise(() => {})) // never resolves
    render(<SpecimenPlate thing={thing({ link: 'https://example.com/a/article' })} {...handlers} />)
    expect(screen.getByRole('link', { name: /example\.com\/a\/article/ })).toBeTruthy()
  })

  it('upgrades to a full card once the Open Graph preview resolves', async () => {
    vi.mocked(getLinkPreview).mockResolvedValue({
      title: 'A Great Article',
      description: 'What it says on the tin.',
      image: 'https://example.com/og.png',
      siteName: 'example.com',
      url: 'https://example.com/a/article',
    })
    const { container } = render(<SpecimenPlate thing={thing({ link: 'https://example.com/a/article' })} {...handlers} />)

    await waitFor(() => expect(screen.getByText('A Great Article')).toBeTruthy())
    expect(screen.getByText('What it says on the tin.')).toBeTruthy()
    expect(screen.getByText('example.com')).toBeTruthy()
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.src).toBe('https://example.com/og.png')
  })

  // A preview response with neither a title nor an image is functionally
  // nothing — falling back to the plain line rather than an empty card
  // with just a site name.
  it('falls back to the plain line when the preview has nothing to show', async () => {
    vi.mocked(getLinkPreview).mockResolvedValue({
      title: null,
      description: null,
      image: null,
      siteName: 'example.com',
      url: 'https://example.com/a/article',
    })
    render(<SpecimenPlate thing={thing({ link: 'https://example.com/a/article' })} {...handlers} />)

    await waitFor(() => expect(getLinkPreview).toHaveBeenCalled())
    expect(screen.getByRole('link', { name: /example\.com\/a\/article/ })).toBeTruthy()
  })

  // A link kept from a share sheet has the article's title as its body, so
  // the card's own title line was the same words a second time.
  it('does not repeat a headline the plate has already printed', async () => {
    vi.mocked(getLinkPreview).mockResolvedValue({
      title: 'A Great Article',
      description: 'What it says on the tin.',
      image: 'https://example.com/og.png',
      siteName: 'example.com',
      url: 'https://example.com/a/article',
    })
    render(<SpecimenPlate thing={thing({ body: 'A Great Article', link: 'https://example.com/a/article' })} {...handlers} />)

    await waitFor(() => expect(screen.getByText('What it says on the tin.')).toBeTruthy())
    expect(screen.getAllByText('A Great Article')).toHaveLength(1)
  })

  // The same, before Keep has trimmed the publication off the shared title.
  it("treats a share sheet's stapled-on site name as the same headline", async () => {
    vi.mocked(getLinkPreview).mockResolvedValue({
      title: 'A Great Article',
      description: 'What it says on the tin.',
      image: 'https://example.com/og.png',
      siteName: 'example.com',
      url: 'https://example.com/a/article',
    })
    render(<SpecimenPlate thing={thing({ body: 'A Great Article — Example', link: 'https://example.com/a/article' })} {...handlers} />)

    await waitFor(() => expect(screen.getByText('What it says on the tin.')).toBeTruthy())
    expect(screen.queryByText('A Great Article')).toBeNull()
  })

  // With the title dropped and nothing else to show, an image-less, blurb-less
  // card would be a frame around a site name — the plain line says more.
  it('falls back to the plain line when the echoed title was all the card had', async () => {
    vi.mocked(getLinkPreview).mockResolvedValue({
      title: 'A Great Article',
      description: null,
      image: null,
      siteName: 'example.com',
      url: 'https://example.com/a/article',
    })
    render(<SpecimenPlate thing={thing({ body: 'A Great Article', link: 'https://example.com/a/article' })} {...handlers} />)

    await waitFor(() => expect(getLinkPreview).toHaveBeenCalled())
    expect(screen.getByRole('link', { name: /example\.com\/a\/article/ })).toBeTruthy()
  })

  it('renders nothing link-related for a thing with no link', () => {
    render(<SpecimenPlate thing={thing()} {...handlers} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  // A row created or edited straight in Notion, or one kept before Silva
  // started filling `link` at intake, could carry a bare-URL body with the
  // `link` field itself empty — the plate used to show that as inert text
  // with no card at all.
  it('reads the link out of a bare-URL body when the link field is empty', () => {
    vi.mocked(getLinkPreview).mockReturnValue(new Promise(() => {}))
    render(<SpecimenPlate thing={thing({ body: 'https://example.com/a/article', link: null })} {...handlers} />)
    expect(screen.getByRole('link', { name: /example\.com\/a\/article/ })).toBeTruthy()
  })

  // With nothing but the URL to the thing, the plain body paragraph would
  // otherwise repeat exactly what the card already shows.
  it('does not also print the bare URL as a second, plain paragraph', () => {
    vi.mocked(getLinkPreview).mockReturnValue(new Promise(() => {}))
    render(<SpecimenPlate thing={thing({ body: 'https://example.com/a/article', link: null })} {...handlers} />)
    expect(screen.getAllByText(/example\.com\/a\/article/)).toHaveLength(1)
  })

  // A URL merely mentioned in prose is not the thing's link — that stays
  // exactly the plain paragraph it always was.
  it('never turns a URL mentioned in prose into the plate\'s link', () => {
    render(<SpecimenPlate thing={thing({ body: 'Worth reading: https://example.com/a', link: null })} {...handlers} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Worth reading: https://example.com/a')).toBeTruthy()
  })
})

describe('SpecimenPlate — letting go of a kept thing', () => {
  // Until this existed, a kept thing could only be removed by deleting it
  // in Notion — the one route that strands a path with a dangling end.
  it('releases straight away, since the undo toast is the way back', async () => {
    const user = userEvent.setup()
    const onRelease = vi.fn()
    render(<SpecimenPlate thing={thing()} {...handlers} onRelease={onRelease} />)

    // Behind More, with the other way out — five labels never fitted a
    // plate's width on a phone, and the pair that removes something is the
    // right pair to put one deliberate tap away.
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Release' }))
    expect(onRelease).toHaveBeenCalledWith('a')
  })

  it('confirms before deleting, and says what else goes with it', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<SpecimenPlate thing={thing()} {...handlers} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText(/along with any path drawn to it/i)).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Delete' }).pop()!)
    expect(onDelete).toHaveBeenCalledWith('a')
  })

  it('offers neither action on a surface that passes no handler', () => {
    render(<SpecimenPlate thing={thing()} {...handlers} />)
    expect(screen.queryByRole('button', { name: 'Release' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })
})

/**
 * The Source field on a plate chooses *which* source a thing points at — it
 * does not rename the source it is pre-filled with. Typing a variant of the
 * current name resolves straight back to the same source, so the save looks
 * like it did nothing at all. Offering the existing sources makes the field
 * legibly a chooser, and makes picking one exact rather than approximate.
 */
describe('SpecimenPlate — the Source field is a chooser', () => {
  const sources: Source[] = [
    { id: 's1', title: 'Nautilus', author: '', kind: 'Article', cover: null, koboVolumeId: null, notes: '' },
    { id: 's2', title: 'Meditations', author: 'Marcus Aurelius', kind: 'Book', cover: null, koboVolumeId: null, notes: '' },
  ]

  it('offers every existing source as a suggestion', async () => {
    const user = userEvent.setup()
    render(<SpecimenPlate thing={thing()} allSources={sources} {...handlers} />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const input = screen.getByLabelText('Source') as HTMLInputElement
    const list = document.getElementById(input.getAttribute('list') || '')
    expect(Array.from(list?.querySelectorAll('option') ?? []).map((o) => o.getAttribute('value'))).toEqual([
      'Nautilus',
      'Meditations by Marcus Aurelius',
    ])
  })

  it('says where renaming a source actually happens', async () => {
    const user = userEvent.setup()
    render(<SpecimenPlate thing={thing()} allSources={sources} {...handlers} />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText(/Rename a source in Roots/i)).toBeTruthy()
  })

  // Nothing to suggest is nothing to wire up.
  it('has no list attribute when there are no sources yet', async () => {
    const user = userEvent.setup()
    render(<SpecimenPlate thing={thing()} {...handlers} />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Source').hasAttribute('list')).toBe(false)
  })

  // Two plates can be open at once; a repeated datalist id would be
  // duplicate ids in one document.
  it('gives each plate its own datalist id', async () => {
    const user = userEvent.setup()
    render(
      <>
        <SpecimenPlate thing={thing({ id: 'a' })} allSources={sources} {...handlers} />
        <SpecimenPlate thing={thing({ id: 'b' })} allSources={sources} {...handlers} />
      </>,
    )
    for (const button of screen.getAllByRole('button', { name: 'Edit' })) await user.click(button)
    const ids = screen.getAllByLabelText('Source').map((i) => i.getAttribute('list'))
    expect(new Set(ids).size).toBe(2)
  })
})

describe('SpecimenPlate — taking a cutting', () => {
  const linked = () => thing({ state: 'Kept', link: 'https://example.com/a/article', body: 'A Great Article' })

  it('plants the passage you took, and closes the form', async () => {
    vi.mocked(getLinkPreview).mockReturnValue(new Promise(() => {}))
    const onCutting = vi.fn()
    const parent = linked()
    render(<SpecimenPlate thing={parent} {...handlers} onCutting={onCutting} />)

    await userEvent.click(screen.getByRole('button', { name: /take a cutting/i }))
    await userEvent.type(screen.getByLabelText(/the passage you took/i), 'The sentence that stopped me.')
    await userEvent.click(screen.getByRole('button', { name: /add to the nursery/i }))

    expect(onCutting).toHaveBeenCalledWith(parent, 'The sentence that stopped me.')
    expect(screen.queryByLabelText(/the passage you took/i)).toBeNull()
  })

  it('will not plant an empty cutting', async () => {
    vi.mocked(getLinkPreview).mockReturnValue(new Promise(() => {}))
    render(<SpecimenPlate thing={linked()} {...handlers} onCutting={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /take a cutting/i }))
    expect(screen.getByRole('button', { name: /add to the nursery/i }).hasAttribute('disabled')).toBe(true)
  })

  // The form opens beside the thing, never instead of it — you are copying a
  // passage out of the page the card below is still showing.
  it('leaves the thing on screen while the form is open', async () => {
    vi.mocked(getLinkPreview).mockReturnValue(new Promise(() => {}))
    render(<SpecimenPlate thing={linked()} {...handlers} onCutting={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /take a cutting/i }))
    expect(screen.getByText('A Great Article')).toBeTruthy()
  })

  it('is offered only where there is a page to take one from', () => {
    vi.mocked(getLinkPreview).mockReturnValue(new Promise(() => {}))
    const { rerender } = render(
      <SpecimenPlate thing={thing({ state: 'Kept', link: null })} {...handlers} onCutting={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /take a cutting/i })).toBeNull()

    // Nor from a seedling still being decided about.
    rerender(<SpecimenPlate thing={thing({ state: 'Understory', link: 'https://example.com/a' })} {...handlers} onCutting={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /take a cutting/i })).toBeNull()

    // And not at all on a surface that doesn't offer it.
    rerender(<SpecimenPlate thing={linked()} {...handlers} />)
    expect(screen.queryByRole('button', { name: /take a cutting/i })).toBeNull()
  })
})

describe('SpecimenPlate — the two ways out', () => {
  it('keeps them behind More until asked, and says so to a screen reader', async () => {
    const user = userEvent.setup()
    render(<SpecimenPlate thing={thing()} {...handlers} onRelease={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Release' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()

    const more = screen.getByRole('button', { name: 'More' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    await user.click(more)

    expect(screen.getByRole('button', { name: 'Release' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Less' }).getAttribute('aria-expanded')).toBe('true')

    await user.click(screen.getByRole('button', { name: 'Less' }))
    expect(screen.queryByRole('button', { name: 'Release' })).toBeNull()
  })

  // A read-only surface passes neither, and then there is nothing to reveal.
  it('is not offered at all when there is nothing behind it', () => {
    render(<SpecimenPlate thing={thing()} {...handlers} />)
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  })

  // The label is the noun so four actions fit one row on a phone; the name a
  // screen reader reads is still the whole phrase.
  it('calls a cutting by its full name where it counts', () => {
    vi.mocked(getLinkPreview).mockReturnValue(new Promise(() => {}))
    render(
      <SpecimenPlate
        thing={thing({ state: 'Kept', link: 'https://example.com/a' })}
        {...handlers}
        onCutting={vi.fn()}
      />,
    )
    const button = screen.getByRole('button', { name: 'Take a cutting' })
    expect(button.textContent).toBe('Cutting')
  })
})
