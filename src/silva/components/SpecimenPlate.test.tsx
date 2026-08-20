// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { SpecimenPlate } from './SpecimenPlate'
import type { Thing } from '../lib/notion'
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

  it('renders nothing link-related for a thing with no link', () => {
    render(<SpecimenPlate thing={thing()} {...handlers} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
