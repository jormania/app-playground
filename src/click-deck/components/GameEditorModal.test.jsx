/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent , cleanup } from '@testing-library/react'
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

  describe('fetchCover', () => {
    afterEach(() => vi.unstubAllGlobals())

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
  })
})
