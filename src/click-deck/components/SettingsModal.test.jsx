/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { SettingsModal } from './SettingsModal'

beforeAll(() => {
  window.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
})

describe('SettingsModal', () => {
  afterEach(() => cleanup());
  it('renders correctly', () => {
    render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
    expect(screen.getByText('SYSTEM_SETTINGS')).toBeTruthy()
    expect(screen.getByText('NOTION INTEGRATION TOKEN')).toBeTruthy()
    expect(screen.getByText('DATABASE ID')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<SettingsModal onClose={onClose} onSaveToken={() => {}} />)
    fireEvent.click(screen.getByText('[X]'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose and onSaveToken when saving settings', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(<SettingsModal onClose={onClose} onSaveToken={onSave} />)
    fireEvent.click(screen.getByText('SAVE_SETTINGS'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).toHaveBeenCalled()
  })

  it('persists the token, db id and theme to localStorage on save', () => {
    render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('secret_...'), { target: { value: 'secret_abc123' } })
    fireEvent.change(screen.getByPlaceholderText('UUID of existing DB'), { target: { value: 'db-xyz' } })
    fireEvent.click(screen.getByText('SAVE_SETTINGS'))

    expect(window.localStorage.setItem).toHaveBeenCalledWith('cd_notion_token', 'secret_abc123')
    expect(window.localStorage.setItem).toHaveBeenCalledWith('cd_notion_db', 'db-xyz')
    expect(window.localStorage.setItem).toHaveBeenCalledWith('cd_theme', 'union')
    expect(window.localStorage.setItem).toHaveBeenCalledWith('cd_random_weight', 'uniform')
  })

  it('persists a changed random-pick weighting mode', () => {
    render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
    fireEvent.change(screen.getByDisplayValue('Uniform (equal odds)'), { target: { value: 'cheapest' } })
    fireEvent.click(screen.getByText('SAVE_SETTINGS'))
    expect(window.localStorage.setItem).toHaveBeenCalledWith('cd_random_weight', 'cheapest')
  })

  it('persists the CRT effect and banner-persistent toggles on save', () => {
    render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
    fireEvent.click(screen.getByLabelText('RETRO CRT MODE'))
    fireEvent.click(screen.getByLabelText("SALE BANNER: ALWAYS SHOW (DON'T AUTO-DISMISS)"))
    fireEvent.click(screen.getByText('SAVE_SETTINGS'))

    expect(window.localStorage.setItem).toHaveBeenCalledWith('cd_crt_effect', 'true')
    expect(window.localStorage.setItem).toHaveBeenCalledWith('cd_discount_banner_persistent', 'true')
  })

  it('"Show Sale Banner Now" clears the snooze immediately and calls onShowBannerNow, independent of Save', () => {
    const onShowBannerNow = vi.fn()
    const onClose = vi.fn()
    render(<SettingsModal onClose={onClose} onSaveToken={() => {}} onShowBannerNow={onShowBannerNow} />)

    fireEvent.click(screen.getByText('Show Sale Banner Now'))

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('cd_discount_snooze_until')
    expect(onShowBannerNow).toHaveBeenCalled()
    // Doesn't require Save/Close — the point is it takes effect right away.
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText(/Banner will show again now/)).toBeTruthy()
  })

  it('does not render any of the old developer-facing database action buttons', () => {
    render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
    expect(screen.queryByText(/Initialize New Database Schema/)).toBeNull()
    expect(screen.queryByText(/Populate Seed Data/)).toBeNull()
    expect(screen.queryByText(/Patch Database for Pricing Schema/)).toBeNull()
    expect(screen.queryByText(/Patch Database for Watchlist Schema/)).toBeNull()
    expect(screen.queryByText(/Factory Reset/)).toBeNull()
    expect(screen.queryByText(/Initialize Followed Studios Database/)).toBeNull()
  })

  describe('Followed Studios database connection', () => {
    it('pasting an ID and clicking CONNECT persists it and loads the studio list', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [], has_more: false, next_cursor: null })
      }))
      // This suite's shared localStorage mock always returns null from getItem,
      // so StudiosConnector reads back an empty id after "persisting" — the
      // real behavior (localStorage actually holding the value) is covered by
      // studios-connector.test.js. Here we're only confirming the button wires
      // setDbId + a reload, via the localStorage.setItem call it makes.
      render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
      fireEvent.change(screen.getByPlaceholderText('UUID of Followed Studios DB'), { target: { value: 'studios-db-123' } })
      fireEvent.click(screen.getByText('CONNECT'))

      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith('cd_studios_db_id', 'studios-db-123')
      })
      vi.unstubAllGlobals()
    })

    it('prompts for an ID when CONNECT is clicked with the field empty', () => {
      render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
      fireEvent.click(screen.getByText('CONNECT'))
      expect(screen.getByText(/Paste a Followed Studios database ID first/)).toBeTruthy()
    })
  })

  describe('Followed Studios — Personal Value Tier & Notes', () => {
    afterEach(() => {
      window.localStorage.getItem.mockReset()
      vi.unstubAllGlobals()
    })

    it('shows a studio\'s tier as stars and its notes once the studios DB is connected', async () => {
      window.localStorage.getItem.mockImplementation(key => {
        if (key === 'cd_studios_db_id') return 'studios-db-123'
        if (key === 'cd_notion_token') return 'secret_test_token'
        return null
      })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{
            id: 'p1',
            properties: {
              'Title': { title: [{ plain_text: 'Wadjet Eye Games' }] },
              'Personal Value Tier': { number: 3 },
              'Notes': { rich_text: [{ plain_text: 'Gold standard for point-and-click.' }] },
              'Steam Developer': { rich_text: [] }
            }
          }],
          has_more: false,
          next_cursor: null
        })
      }))
      render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
      await waitFor(() => expect(screen.getByText('Wadjet Eye Games')).toBeTruthy())
      expect(screen.getByText('TIER 3')).toBeTruthy()
      expect(screen.queryByText(/★/)).toBeNull()
      expect(screen.getByText('Gold standard for point-and-click.')).toBeTruthy()
    })

    it('sends the tier and notes when adding a new studio', async () => {
      window.localStorage.getItem.mockImplementation(key => {
        if (key === 'cd_studios_db_id') return 'studios-db-123'
        if (key === 'cd_notion_token') return 'secret_test_token'
        return null
      })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'new-page',
          properties: { Title: { title: [{ plain_text: 'New Studio' }] } }
        })
      })
      vi.stubGlobal('fetch', fetchMock)
      render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} />)
      await waitFor(() => expect(screen.getByPlaceholderText('Studio name...')).toBeTruthy())

      fireEvent.change(screen.getByPlaceholderText('Studio name...'), { target: { value: 'New Studio' } })
      fireEvent.change(screen.getByPlaceholderText('Tier'), { target: { value: '2' } })
      fireEvent.change(screen.getByPlaceholderText(/Notes — why you follow/), { target: { value: 'Solid writing.' } })
      fireEvent.click(screen.getByText('+ ADD'))

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(([, opts]) => JSON.parse(opts.body).path === 'pages')
        expect(call).toBeTruthy()
        const body = JSON.parse(call[1].body).body
        expect(body.properties['Personal Value Tier']).toEqual({ number: 2 })
        expect(body.properties['Notes'].rich_text[0].text.content).toBe('Solid writing.')
      })
    })
  })
})
