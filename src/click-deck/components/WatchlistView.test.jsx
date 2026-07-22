/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { WatchlistView } from './WatchlistView'

describe('WatchlistView', () => {
  // sessionStorage too: the candidate list is now cached there across view
  // switches, so it must be cleared or a prior test's results leak in.
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  const comingSoonGame = {
    id: 'cs1', title: 'Jordi & Oslo: The Lost Tail', developer: 'De Falces',
    year: 2027, appId: 2966330, releaseStatus: 'Coming Soon', releaseDate: 'Q3 2027',
    createdTime: '2026-01-01T00:00:00.000Z', tags: [], status: 'Backlog'
  }
  const releasedGame = {
    id: 'rel1', title: 'Freshly Out', developer: 'Some Studio',
    year: 2026, appId: 111, releaseStatus: 'Released',
    releasedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    releaseDate: '17 Jul, 2026', createdTime: '2026-01-01T00:00:00.000Z', tags: [], status: 'Backlog'
  }

  it('shows an empty-state message when there is nothing tracked or recently released', () => {
    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    expect(screen.getByText(/Nothing tracked yet/)).toBeTruthy()
    expect(screen.getByText(/Nothing has flipped/)).toBeTruthy()
  })

  it('lists a Coming Soon game under COMING SOON with its expected date, and excludes it from RECENTLY RELEASED', () => {
    render(<WatchlistView games={[comingSoonGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    expect(screen.getByText('Jordi & Oslo: The Lost Tail')).toBeTruthy()
    expect(screen.getByText(/EXPECTED: Q3 2027/)).toBeTruthy()
  })

  it('lists a recently-transitioned game under RECENTLY RELEASED with its release date', () => {
    render(<WatchlistView games={[releasedGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    expect(screen.getByText('Freshly Out')).toBeTruthy()
    expect(screen.getByText(/RELEASED: 17 Jul, 2026/)).toBeTruthy()
  })

  it('header stat line reflects tracked / recently-released counts', () => {
    render(<WatchlistView games={[comingSoonGame, releasedGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    // "1 tracked", "1 just released" — loosely matched since the count is a <strong> child.
    const statLine = document.querySelector('.cd-watchlist-stat-line')
    expect(statLine.textContent).toContain('tracked')
    expect(statLine.textContent).toContain('just released')
  })

  it('clicking [E]DIT on a Coming Soon card calls onEdit with that game', () => {
    const onEdit = vi.fn()
    render(<WatchlistView games={[comingSoonGame]} onEdit={onEdit} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    fireEvent.click(screen.getByText('[E]DIT'))
    expect(onEdit).toHaveBeenCalledWith(comingSoonGame)
  })

  it('"Find New Games" is styled as the primary action; "Refresh Release Dates" is secondary', () => {
    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    expect(screen.getByText('🔭 FIND NEW GAMES').className).toContain('primary')
    expect(screen.getByText('🔄 REFRESH RELEASE DATES').className).not.toContain('primary')
  })

  it('renders a candidate\'s Personal Value Tier as stars next to its matched studio', () => {
    const cached = {
      notYetReleased: [{ appId: 999, title: 'Tiered Candidate', matchedStudio: 'Wadjet Eye Games', studioTier: 3, comingSoon: true, releaseDateString: '2027', headerImage: 'x', duplicate: null }],
      alreadyReleased: []
    }
    sessionStorage.setItem('cd_watchlist_candidates', JSON.stringify(cached))
    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    const row = screen.getByText('Tiered Candidate').closest('.cd-candidate-row')
    expect(within(row).getByText(/★★★☆☆/)).toBeTruthy()
    expect(within(row).getByText(/Wadjet Eye Games/)).toBeTruthy()
  })

  it('renders no stars for a candidate whose studio has no tier set', () => {
    const cached = {
      notYetReleased: [{ appId: 998, title: 'Untiered Candidate', matchedStudio: 'Legacy Studio', studioTier: null, comingSoon: true, releaseDateString: '2027', headerImage: 'x', duplicate: null }],
      alreadyReleased: []
    }
    sessionStorage.setItem('cd_watchlist_candidates', JSON.stringify(cached))
    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    const row = screen.getByText('Untiered Candidate').closest('.cd-candidate-row')
    expect(within(row).queryByText(/★/)).toBeNull()
  })

  it('colours an overdue Coming Soon date distinctly from a TBA one', () => {
    const overdueGame = { ...comingSoonGame, id: 'overdue1', title: 'Overdue Game', releaseDate: '1 Jan, 2020' }
    const tbaGame = { ...comingSoonGame, id: 'tba1', title: 'TBA Game', releaseDate: '', year: null }
    render(<WatchlistView games={[overdueGame, tbaGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    const overdueLine = screen.getByText(/EXPECTED: 1 Jan, 2020/)
    const tbaLine = screen.getByText(/EXPECTED: TBA/)
    expect(overdueLine.className).toContain('cd-expected-overdue')
    expect(tbaLine.className).toContain('cd-expected-tba')
  })

  it('"Find New Games" toasts a message when there are no followed studios yet', async () => {
    const onToast = vi.fn()
    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={onToast} />)
    fireEvent.click(screen.getByText('🔭 FIND NEW GAMES'))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringContaining('No followed studios yet')))
  })

  it('"Refresh Release Dates" toasts when there is nothing Coming Soon to check', async () => {
    const onToast = vi.fn()
    render(<WatchlistView games={[releasedGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={onToast} />)
    fireEvent.click(screen.getByText('🔄 REFRESH RELEASE DATES'))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Nothing in Coming Soon to check.'))
  })

  it('"Refresh Release Dates" applies a flip via the appdetails proxy and reports it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        '2966330': { success: true, data: { release_date: { coming_soon: false, date: '1 Aug, 2026' } } }
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const onApplyGameUpdates = vi.fn()
    const onToast = vi.fn()

    render(<WatchlistView games={[comingSoonGame]} onEdit={() => {}} onApplyGameUpdates={onApplyGameUpdates} onAddGame={() => {}} onToast={onToast} />)
    fireEvent.click(screen.getByText('🔄 REFRESH RELEASE DATES'))

    await waitFor(() => expect(onApplyGameUpdates).toHaveBeenCalled())
    const [updated] = onApplyGameUpdates.mock.calls[0]
    expect(updated[0].releaseStatus).toBe('Released')
    expect(updated[0].releasedAt).toBeTruthy()
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringContaining('just released')))
  })

  it('restores cached candidates from sessionStorage on mount (survives a view switch)', () => {
    const cached = {
      notYetReleased: [{ appId: 999, title: 'Cached Upcoming', matchedStudio: 'Some Studio', comingSoon: true, releaseDateString: '2027', headerImage: 'x', duplicate: null }],
      alreadyReleased: []
    }
    sessionStorage.setItem('cd_watchlist_candidates', JSON.stringify(cached))
    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    expect(screen.getByText('Cached Upcoming')).toBeTruthy()
    expect(screen.getByText('NOT YET RELEASED')).toBeTruthy()
  })

  it('adding a candidate does NOT fire the removed Python-runner endpoint (Wave 2 regression guard)', async () => {
    const cached = {
      notYetReleased: [{ appId: 999, title: 'Addable', matchedStudio: 'Some Studio', comingSoon: true, releaseDateString: '2027', headerImage: 'x', duplicate: null }],
      alreadyReleased: []
    }
    sessionStorage.setItem('cd_watchlist_candidates', JSON.stringify(cached))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const onAddGame = vi.fn().mockResolvedValue(undefined)

    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={onAddGame} onToast={() => {}} />)
    fireEvent.click(screen.getByText('+ ADD'))

    await waitFor(() => expect(onAddGame).toHaveBeenCalled())
    // The old flow fired fetch('/api/run-python-scripts') here; nothing should hit it now.
    const calledUrls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(calledUrls.some(u => u.includes('run-python-scripts'))).toBe(false)
  })

  describe('"last checked" (regression: previously stuck on "never")', () => {
    it('shows "never" when priceUpdatedAt has never been stamped', () => {
      render(<WatchlistView games={[comingSoonGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
      expect(screen.getByText(/last checked: never/)).toBeTruthy()
    })

    it('reflects a real "today" once the game carries a fresh priceUpdatedAt — this is what the nightly cron / manual refresh are supposed to produce', () => {
      const justChecked = { ...comingSoonGame, priceUpdatedAt: new Date().toISOString() }
      render(<WatchlistView games={[justChecked]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
      expect(screen.getByText(/last checked: today/)).toBeTruthy()
      expect(screen.queryByText(/last checked: never/)).toBeNull()
    })
  })

  describe('IGNORE on a candidate', () => {
    const cachedWithDup = {
      notYetReleased: [{ appId: 999, title: 'Maybe Later', matchedStudio: 'Some Studio', comingSoon: true, releaseDateString: '2027', headerImage: 'x', duplicate: null }],
      alreadyReleased: []
    }

    it('writes the candidate as Ignored (not Coming Soon), removes it from the candidate list, and never stamps Released At', async () => {
      sessionStorage.setItem('cd_watchlist_candidates', JSON.stringify(cachedWithDup))
      const onAddGame = vi.fn().mockResolvedValue(undefined)
      const onToast = vi.fn()
      render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={onAddGame} onToast={onToast} />)

      fireEvent.click(screen.getByText('− IGNORE'))

      await waitFor(() => expect(onAddGame).toHaveBeenCalled())
      const [saved] = onAddGame.mock.calls[0]
      expect(saved.releaseStatus).toBe('Ignored')
      expect(saved.releasedAt).toBeNull()
      await waitFor(() => expect(screen.queryByText('Maybe Later')).toBeNull())
      expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Ignored "Maybe Later"'))
    })

    it('does not offer an IGNORE button for a candidate already an exact duplicate', () => {
      const cached = {
        notYetReleased: [{ appId: 999, title: 'Already Mine', comingSoon: true, headerImage: 'x', duplicate: { kind: 'exact', match: { title: 'Already Mine' } } }],
        alreadyReleased: []
      }
      sessionStorage.setItem('cd_watchlist_candidates', JSON.stringify(cached))
      render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
      const row = screen.getByText('Already Mine').closest('.cd-candidate-row')
      expect(within(row).queryByText('− IGNORE')).toBeNull()
    })
  })

  describe('IGNORED section', () => {
    const ignoredGame = {
      id: 'ig1', title: 'Not For Me', developer: 'Some Studio', appId: 555,
      releaseStatus: 'Ignored', releasedAt: null, createdTime: '2026-06-01T00:00:00.000Z', tags: [], status: 'Backlog'
    }

    it('shows a collapsed toggle with the count, and expands to list ignored games on click', () => {
      render(<WatchlistView games={[ignoredGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
      expect(screen.getByText('[+] IGNORED (1)')).toBeTruthy()
      expect(screen.queryByText('Not For Me')).toBeNull() // collapsed by default

      fireEvent.click(screen.getByText('[+] IGNORED (1)'))
      expect(screen.getByText('[−] IGNORED (1)')).toBeTruthy()
      expect(screen.getByText('Not For Me')).toBeTruthy()
    })

    it('does not show an ignored game anywhere in Coming Soon / Recently Released', () => {
      render(<WatchlistView games={[ignoredGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
      // It only ever appears once expanded, never in the always-visible sections.
      expect(screen.getByText(/Nothing tracked yet/)).toBeTruthy()
      expect(screen.getByText(/Nothing has flipped/)).toBeTruthy()
    })

    it('UN-IGNORE re-checks Steam and restores the game via onApplyGameUpdates, without stamping Released At even if it has launched', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ '555': { success: true, data: { release_date: { coming_soon: false, date: '1 Jan, 2026' }, price_overview: { final: 999, initial: 999, discount_percent: 0 } } } })
      }))
      const onApplyGameUpdates = vi.fn()
      render(<WatchlistView games={[ignoredGame]} onEdit={() => {}} onApplyGameUpdates={onApplyGameUpdates} onAddGame={() => {}} onToast={() => {}} />)
      fireEvent.click(screen.getByText('[+] IGNORED (1)'))
      fireEvent.click(screen.getByText('UN-IGNORE'))

      await waitFor(() => expect(onApplyGameUpdates).toHaveBeenCalled())
      const [updatedArray] = onApplyGameUpdates.mock.calls[0]
      const [restored] = updatedArray
      expect(restored.releaseStatus).toBe('Released')
      expect(restored.releasedAt).toBeNull()
    })

    it('exports the ignored list as a downloadable JSON blob', () => {
      const createObjectURL = vi.fn(() => 'blob:mock')
      const revokeObjectURL = vi.fn()
      const originalCreate = global.URL.createObjectURL
      const originalRevoke = global.URL.revokeObjectURL
      global.URL.createObjectURL = createObjectURL
      global.URL.revokeObjectURL = revokeObjectURL
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      render(<WatchlistView games={[ignoredGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
      fireEvent.click(screen.getByText('[+] IGNORED (1)'))
      fireEvent.click(screen.getByText('[EXPORT IGNORED JSON]'))

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const [blobArg] = createObjectURL.mock.calls[0]
      expect(blobArg.type).toBe('application/json')
      expect(clickSpy).toHaveBeenCalled()

      clickSpy.mockRestore()
      global.URL.createObjectURL = originalCreate
      global.URL.revokeObjectURL = originalRevoke
    })
  })

  describe('clickable covers', () => {
    it('a Coming Soon card cover links straight to the Steam store page', () => {
      render(<WatchlistView games={[comingSoonGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
      const link = document.querySelector('a.cd-watchlist-cover-container')
      expect(link).toBeTruthy()
      expect(link.getAttribute('href')).toBe('https://store.steampowered.com/app/2966330')
      expect(link.getAttribute('target')).toBe('_blank')
    })

    it('a Recently Released card cover also links to Steam', () => {
      render(<WatchlistView games={[releasedGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
      const link = document.querySelector('a.cd-watchlist-cover-container')
      expect(link.getAttribute('href')).toBe('https://store.steampowered.com/app/111')
    })
  })
})
