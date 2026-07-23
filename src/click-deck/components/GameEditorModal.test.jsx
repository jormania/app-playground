/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { GameEditorModal } from './GameEditorModal'

import { afterEach } from 'vitest';

describe('GameEditorModal', () => {
  afterEach(() => cleanup());
  it('renders correctly for new entry', () => {
    render(<GameEditorModal game={null} onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByText('NEW_ENTRY')).toBeTruthy()
  })

  it('renders correctly for editing an existing entry', () => {
    const game = {
      title: 'Monkey Island',
      year: 1990,
      developer: 'LucasArts',
      status: 'Completed',
      tags: [],
      journal: ''
    }
    render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByText('EDIT_ENTRY')).toBeTruthy()
    expect(screen.getByDisplayValue('Monkey Island')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<GameEditorModal game={null} onSave={() => {}} onClose={onClose} />)
    const closeButtons = screen.getAllByText('[X]')
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('shows validation error and does not save when title is missing', () => {
    const onSave = vi.fn()
    render(<GameEditorModal game={null} onSave={onSave} onClose={() => {}} />)
    fireEvent.click(screen.getByText('SAVE_DATA'))
    expect(screen.getByText(/TITLE REQUIRED/)).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps a legacy off-list tag visible and removable', () => {
    const game = {
      title: 'Old Entry', year: 2000, developer: '', status: 'Backlog',
      tags: ['Some Retired Tag'], journal: ''
    }
    render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} />)
    const tagEl = screen.getByText('Some Retired Tag')
    expect(tagEl.className).toContain('active')

    // Clicking it removes it from formData.tags; since it's not in the
    // canonical ALL_TAGS list either, it should disappear from the picker
    // entirely rather than linger unselected.
    fireEvent.click(tagEl)
    expect(screen.queryByText('Some Retired Tag')).toBeNull()
  })

  it('blocks adding a new tag once 7 are already selected', () => {
    const game = {
      title: 'Tag Heavy', year: 2000, developer: '', status: 'Backlog',
      // 7 real tags from the picker, so no 8th can be added.
      tags: ['Point & Click', 'Sci-Fi', 'Cyberpunk', 'Mystery', 'Detective', 'Noir', 'Classic'],
      journal: ''
    }
    render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByText('TAGS (7/7)')).toBeTruthy()
    fireEvent.click(screen.getByText('Comedy'))
    // Still 7 — the 8th click is a no-op.
    expect(screen.getByText('TAGS (7/7)')).toBeTruthy()
    expect(screen.getByText('Comedy').className).not.toContain('active')
  })

  it('warns when an entry has fewer than 5 tags', () => {
    const game = {
      title: 'Sparse', year: 2000, developer: '', status: 'Backlog',
      tags: ['Comedy', 'Sci-Fi'], journal: ''
    }
    render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/Collection policy calls for 5–7 tags/)).toBeTruthy()
  })

  it('warns when a legacy entry has more than 7 tags, but not for a valid entry', () => {
    const overTagged = {
      title: 'Over', year: 2000, developer: '', status: 'Backlog',
      tags: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], journal: ''
    }
    const { rerender } = render(<GameEditorModal game={overTagged} onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/predates the current cap/)).toBeTruthy()

    const inRange = {
      title: 'InRange', year: 2000, developer: '', status: 'Backlog',
      tags: ['Point & Click', 'Sci-Fi', 'Cyberpunk', 'Mystery', 'Detective'], journal: ''
    }
    rerender(<GameEditorModal game={inRange} onSave={() => {}} onClose={() => {}} />)
    expect(screen.queryByText(/Collection policy calls for 5–7 tags/)).toBeNull()
  })

  describe('rich-text journal preservation', () => {
    const richGame = {
      title: 'Richly Formatted', year: 2000, developer: '', status: 'Backlog',
      tags: ['Point & Click', 'Sci-Fi', 'Cyberpunk', 'Mystery', 'Detective'],
      journal: 'A masterclass.',
      journalRich: [
        { plain_text: 'A ', annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' } },
        { plain_text: 'masterclass', annotations: { bold: true, italic: false, strikethrough: false, underline: false, code: false, color: 'orange' } },
        { plain_text: '.', annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' } }
      ]
    }

    it('forwards journalRich unchanged when the journal text was not edited', () => {
      const onSave = vi.fn()
      render(<GameEditorModal game={richGame} onSave={onSave} onClose={() => {}} />)
      fireEvent.click(screen.getByText('SAVE_DATA'))
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ journalRich: richGame.journalRich }))
    })

    it('strips journalRich when the journal text was edited, so plain text is saved instead', () => {
      const onSave = vi.fn()
      render(<GameEditorModal game={richGame} onSave={onSave} onClose={() => {}} />)
      const textarea = document.querySelector('textarea[name="journal"]')
      fireEvent.change(textarea, { target: { value: 'A masterclass, rewritten.' } })
      fireEvent.click(screen.getByText('SAVE_DATA'))
      const saved = onSave.mock.calls[0][0]
      expect(saved.journal).toBe('A masterclass, rewritten.')
      expect(saved.journalRich).toBeUndefined()
    })

    it('warns that saving an edited journal will replace its rich formatting', () => {
      render(<GameEditorModal game={richGame} onSave={() => {}} onClose={() => {}} />)
      expect(screen.queryByText(/will replace it with plain text/)).toBeNull()

      const textarea = document.querySelector('textarea[name="journal"]')
      fireEvent.change(textarea, { target: { value: 'Edited.' } })
      expect(screen.getByText(/will replace it with plain text/)).toBeTruthy()
    })

    it('does not warn for a plain (never-formatted) journal', () => {
      const plainGame = { title: 'Plain', year: 2000, developer: '', status: 'Backlog', tags: [], journal: 'Just text.' }
      render(<GameEditorModal game={plainGame} onSave={() => {}} onClose={() => {}} />)
      const textarea = document.querySelector('textarea[name="journal"]')
      fireEvent.change(textarea, { target: { value: 'Edited plain text.' } })
      expect(screen.queryByText(/will replace it with plain text/)).toBeNull()
    })
  })

  describe('Completed At field', () => {
    it('is hidden when neither the collection nor this game supports the R2 schema', () => {
      const game = { title: 'Pre-R2', year: 2000, developer: '', status: 'Completed', tags: [], journal: '' }
      render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} />)
      expect(screen.queryByText('COMPLETED AT')).toBeNull()
    })

    it('shows and is editable once the collection has the schema (completedAtSchemaReady)', () => {
      const onSave = vi.fn()
      const game = { title: 'Patched', year: 2000, developer: '', status: 'Completed', tags: [], journal: '', completedAt: '2026-07-01' }
      render(<GameEditorModal game={game} onSave={onSave} onClose={() => {}} completedAtSchemaReady={true} />)
      expect(screen.getByText('COMPLETED AT')).toBeTruthy()
      const input = document.querySelector('input[name="completedAt"]')
      expect(input.value).toBe('2026-07-01')

      fireEvent.change(input, { target: { value: '2026-07-15' } })
      fireEvent.click(screen.getByText('SAVE_DATA'))
      expect(onSave.mock.calls[0][0].completedAt).toBe('2026-07-15')
    })

    it('shows when this specific game already carries completedAt, even if the collection flag is false', () => {
      const game = { title: 'Individually patched', year: 2000, developer: '', status: 'Completed', tags: [], journal: '', completedAt: null }
      render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} completedAtSchemaReady={false} />)
      expect(screen.getByText('COMPLETED AT')).toBeTruthy()
    })

    it('clearing the date input saves null, not an empty string', () => {
      const onSave = vi.fn()
      const game = { title: 'Clearable', year: 2000, developer: '', status: 'Completed', tags: [], journal: '', completedAt: '2026-07-01' }
      render(<GameEditorModal game={game} onSave={onSave} onClose={() => {}} completedAtSchemaReady={true} />)
      const input = document.querySelector('input[name="completedAt"]')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.click(screen.getByText('SAVE_DATA'))
      expect(onSave.mock.calls[0][0].completedAt).toBeNull()
    })
  })

  describe('Length (hrs) field', () => {
    it('is hidden when neither the collection nor this game supports the R2 schema', () => {
      const game = { title: 'Pre-R2', year: 2000, developer: '', status: 'Backlog', tags: [], journal: '' }
      render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} />)
      expect(screen.queryByText(/LENGTH \(HRS\)/)).toBeNull()
    })

    it('shows and is editable once the collection has the schema', () => {
      const onSave = vi.fn()
      const game = { title: 'Patched', year: 2000, developer: '', status: 'Backlog', tags: [], journal: '', lengthHours: 10 }
      render(<GameEditorModal game={game} onSave={onSave} onClose={() => {}} lengthHoursSchemaReady={true} />)
      const input = document.querySelector('input[name="lengthHours"]')
      expect(input.value).toBe('10')

      fireEvent.change(input, { target: { value: '12.5' } })
      fireEvent.click(screen.getByText('SAVE_DATA'))
      expect(onSave.mock.calls[0][0].lengthHours).toBe(12.5)
    })

    it('clearing the number input saves null, not an empty string', () => {
      const onSave = vi.fn()
      const game = { title: 'Clearable', year: 2000, developer: '', status: 'Backlog', tags: [], journal: '', lengthHours: 10 }
      render(<GameEditorModal game={game} onSave={onSave} onClose={() => {}} lengthHoursSchemaReady={true} />)
      const input = document.querySelector('input[name="lengthHours"]')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.click(screen.getByText('SAVE_DATA'))
      expect(onSave.mock.calls[0][0].lengthHours).toBeNull()
    })

    describe('FETCH HLTB', () => {
      afterEach(() => vi.unstubAllGlobals())

      it('fetches and applies the best HLTB match', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ items: [{ id: 4123, name: 'Grim Fandango', hours: 11.5 }] })
        })
        vi.stubGlobal('fetch', fetchMock)
        const onSave = vi.fn()

        const game = { title: 'Grim Fandango', year: 1998, developer: '', status: 'Backlog', tags: [], journal: '', lengthHours: null }
        render(<GameEditorModal game={game} onSave={onSave} onClose={() => {}} lengthHoursSchemaReady={true} />)
        fireEvent.click(screen.getByText('FETCH HLTB'))
        await screen.findByDisplayValue('11.5')

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/clickdeck-hltb?term='))

        fireEvent.click(screen.getByText('SAVE_DATA'))
        expect(onSave.mock.calls[0][0].lengthHours).toBe(11.5)
      })

      it('toasts a clear error and leaves the field alone when the proxy fails', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ message: 'Could not reach HowLongToBeat: HLTB init returned 403' })
        })
        vi.stubGlobal('fetch', fetchMock)
        const onToast = vi.fn()

        const game = { title: 'Grim Fandango', year: 1998, developer: '', status: 'Backlog', tags: [], journal: '', lengthHours: null }
        render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} onToast={onToast} lengthHoursSchemaReady={true} />)
        fireEvent.click(screen.getByText('FETCH HLTB'))

        await waitFor(() => {
          expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Could not reach HowLongToBeat'))
        })
        const input = document.querySelector('input[name="lengthHours"]')
        expect(input.value).toBe('')
      })

      it('warns when the best HLTB match is only an unconfident guess', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ items: [{ id: 1, name: 'Norcopolis Chronicles: Deluxe Edition', hours: 8 }] })
        })
        vi.stubGlobal('fetch', fetchMock)
        const onToast = vi.fn()

        const game = { title: 'Norco', year: 2022, developer: '', status: 'Backlog', tags: [], journal: '', lengthHours: null }
        render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} onToast={onToast} lengthHoursSchemaReady={true} />)
        fireEvent.click(screen.getByText('FETCH HLTB'))

        await waitFor(() => {
          expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Uncertain HLTB match'))
        })
      })
    })
  })

  describe('Steam Rating field', () => {
    it('is hidden when neither the collection nor this game supports the schema', () => {
      const game = { title: 'Pre-feature', year: 2000, developer: '', status: 'Backlog', tags: [], journal: '' }
      render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} />)
      expect(screen.queryByText(/STEAM RATING/)).toBeNull()
    })

    it('shows and is editable once the collection has the schema', () => {
      const onSave = vi.fn()
      const game = { title: 'Patched', year: 2000, developer: '', status: 'Backlog', tags: [], journal: '', appId: 123, steamReviewPercent: 92 }
      render(<GameEditorModal game={game} onSave={onSave} onClose={() => {}} reviewSchemaReady={true} />)
      const input = document.querySelector('input[name="steamReviewPercent"]')
      expect(input.value).toBe('92')

      fireEvent.change(input, { target: { value: '88' } })
      fireEvent.click(screen.getByText('SAVE_DATA'))
      expect(onSave.mock.calls[0][0].steamReviewPercent).toBe(88)
    })

    it('shows the desc/count line when present', () => {
      const game = {
        title: 'Reviewed', year: 2000, developer: '', status: 'Backlog', tags: [], journal: '',
        appId: 123, steamReviewPercent: 95, steamReviewDesc: 'Overwhelmingly Positive', steamReviewCount: 9586
      }
      render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} reviewSchemaReady={true} />)
      expect(screen.getByText(/Overwhelmingly Positive/)).toBeTruthy()
      expect(screen.getByText(/9,586 reviews/)).toBeTruthy()
    })

    describe('FETCH RATING', () => {
      afterEach(() => vi.unstubAllGlobals())

      it('is disabled until the game has a Steam App ID', () => {
        const game = { title: 'No App ID Yet', year: 2000, developer: '', status: 'Backlog', tags: [], journal: '' }
        render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} reviewSchemaReady={true} />)
        expect(screen.getByText('FETCH RATING').closest('button').disabled).toBe(true)
      })

      it('fetches and applies a review summary for a game that already has an App ID', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ coverUrl: 'x', reviewSummary: { percent: 92, count: 1500, desc: 'Very Positive' } })
        })
        vi.stubGlobal('fetch', fetchMock)
        const onSave = vi.fn()

        const game = { title: 'Old Skies', year: 2025, developer: '', status: 'Backlog', tags: [], journal: '', appId: 123 }
        render(<GameEditorModal game={game} onSave={onSave} onClose={() => {}} reviewSchemaReady={true} />)
        fireEvent.click(screen.getByText('FETCH RATING'))
        await screen.findByDisplayValue('92')

        expect(fetchMock).toHaveBeenCalledWith('/api/steam-search?appId=123')
        expect(screen.getByText(/Very Positive/)).toBeTruthy()

        fireEvent.click(screen.getByText('SAVE_DATA'))
        expect(onSave.mock.calls[0][0].steamReviewPercent).toBe(92)
        expect(onSave.mock.calls[0][0].steamReviewCount).toBe(1500)
      })

      it('toasts when Steam has no reviews to report (still Coming Soon, or genuinely none)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ coverUrl: 'x', reviewSummary: null }) }))
        const onToast = vi.fn()

        const game = { title: 'Signet City', year: 2026, developer: '', status: 'Backlog', tags: [], journal: '', appId: 456 }
        render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} onToast={onToast} reviewSchemaReady={true} />)
        fireEvent.click(screen.getByText('FETCH RATING'))

        await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringContaining('no reviews')))
      })

      it('toasts a clear error when the proxy fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'Origin not allowed.' }) }))
        const onToast = vi.fn()

        const game = { title: 'X', year: 2000, developer: '', status: 'Backlog', tags: [], journal: '', appId: 123 }
        render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} onToast={onToast} reviewSchemaReady={true} />)
        fireEvent.click(screen.getByText('FETCH RATING'))

        await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Origin not allowed')))
      })
    })
  })

  describe('fetchCover', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('also populates the Steam Rating fields when FETCH STEAM resolves an App ID (populate-on-add)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ json: async () => ({ items: [{ id: 355570, name: 'Grim Fandango Remastered' }] }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ coverUrl: 'https://example.com/355570/header.jpg', reviewSummary: { percent: 96, count: 8000, desc: 'Overwhelmingly Positive' } })
        })
      vi.stubGlobal('fetch', fetchMock)
      const onSave = vi.fn()

      // A brand-new add (no `game` prop) — this is exactly the "add a new
      // game via FETCH STEAM" flow the populate-on-add behavior targets.
      render(<GameEditorModal game={null} onSave={onSave} onClose={() => {}} reviewSchemaReady={true} />)
      fireEvent.change(document.querySelector('input[name="title"]'), { target: { value: 'Grim Fandango' } })
      fireEvent.click(screen.getByText('FETCH STEAM'))
      await screen.findByDisplayValue('96')

      fireEvent.click(screen.getByText('SAVE_DATA'))
      const saved = onSave.mock.calls[0][0]
      expect(saved.steamReviewPercent).toBe(96)
      expect(saved.steamReviewDesc).toBe('Overwhelmingly Positive')
      expect(saved.steamReviewCount).toBe(8000)
    })

    it('saves both coverUrl and appId from the best-matching Steam search result', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ items: [
          { id: 999, name: 'Unrelated Game' },
          { id: 355570, name: 'Grim Fandango Remastered' }
        ] })
      })
      vi.stubGlobal('fetch', fetchMock)
      const onSave = vi.fn()

      const game = { title: 'Grim Fandango', year: 1998, developer: '', status: 'Backlog', tags: [], journal: '' }
      render(<GameEditorModal game={game} onSave={onSave} onClose={() => {}} />)
      fireEvent.click(screen.getByText('FETCH STEAM'))
      await screen.findByDisplayValue(/355570\/header\.jpg/)

      fireEvent.click(screen.getByText('SAVE_DATA'))

      // Previously only coverUrl was ever set here — appId (needed for the
      // Steam-link and the nightly pricing cron) was silently dropped.
      const saved = onSave.mock.calls[0][0]
      expect(saved.appId).toBe(355570)
      expect(saved.coverUrl).toContain('355570')
    })

    it('does not warn when the Steam match is confident', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ items: [{ id: 355570, name: 'Grim Fandango Remastered' }] })
      })
      vi.stubGlobal('fetch', fetchMock)
      const onToast = vi.fn()

      const game = { title: 'Grim Fandango', year: 1998, developer: '', status: 'Backlog', tags: [], journal: '' }
      render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} onToast={onToast} />)
      fireEvent.click(screen.getByText('FETCH STEAM'))
      await screen.findByDisplayValue(/355570\/header\.jpg/)

      expect(onToast).not.toHaveBeenCalled()
    })

    it('warns when the best Steam match is only a coincidental substring, not a confident one', async () => {
      // "Norco" is a short, generic-enough title that it can turn up as a
      // literal substring inside an unrelated, much longer Steam listing —
      // the fetch should still apply it as a best-effort guess, but the user
      // needs to know it wasn't verified.
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ items: [{ id: 1, name: 'Norcopolis Chronicles: Deluxe Edition' }] })
      })
      vi.stubGlobal('fetch', fetchMock)
      const onToast = vi.fn()

      const game = { title: 'Norco', year: 2022, developer: '', status: 'Backlog', tags: [], journal: '' }
      render(<GameEditorModal game={game} onSave={() => {}} onClose={() => {}} onToast={onToast} />)
      fireEvent.click(screen.getByText('FETCH STEAM'))
      await screen.findByDisplayValue(/\/1\/header\.jpg/)

      expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Uncertain Steam match'))
    })
  })
})
