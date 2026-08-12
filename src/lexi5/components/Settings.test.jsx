// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeAll, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Settings } from './Settings'
import { loadGuesses } from '../lib/gameState'

// Curation filters the model's output through isValidGuess, which reads the on-demand
// guess list — without it every candidate word is rejected.
beforeAll(async () => { await loadGuesses() })

// Mock the child components and external dependencies
vi.mock('../../ds', () => ({
  Modal: ({ children, open }) => (open ? <div data-testid="modal">{children}</div> : null),
  SegmentedControl: ({ value, onChange }) => (
    <select data-testid="segmented-control" value={value} onChange={e => onChange(e.target.value)}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  ),
  Button: ({ children, onClick, disabled }) => (
    <button data-testid="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
  // Passes the *event*, like the real SettingsToggle — the previous mock handed the
  // consumer a bare boolean, so `e.target.checked` in Settings would have thrown against
  // it. The tests only passed because none of them toggled anything.
  SettingsToggle: ({ label, hint, checked, onChange, disabled }) => (
    <div data-testid="settings-toggle">
      <label>
        {label}
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      </label>
      <span>{hint}</span>
    </div>
  )
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

describe('Settings component', () => {
  const defaultConfig = {
    theme: 'system',
    dictionary: 'standard',
    difficulty: 'normal',
    smartKeyboard: true
  }

  const mockOnConfigChange = vi.fn()
  const mockOnDictionaryChange = vi.fn()
  const mockOnDifficultyChange = vi.fn()
  const mockOnResetStats = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Mock fetch for Anthropic API
    global.fetch = vi.fn()
  })

  afterEach(cleanup)

  it('disables the Custom dictionary option when no custom list is in localStorage', () => {
    render(
      <Settings
        open={true}
        onClose={() => {}}
        config={defaultConfig}
        onConfigChange={mockOnConfigChange}
        onDictionaryChange={mockOnDictionaryChange}
        onDifficultyChange={mockOnDifficultyChange}
        onResetStats={mockOnResetStats}
        openToCurate={false}
      />
    )

    const select = screen.getAllByRole('combobox')[0]
    const customOption = Array.from(select.options).find(opt => opt.value === 'custom')
    expect(customOption.disabled).toBe(true)
    expect(customOption.textContent).toContain('curate one below first')
  })

  it('handles curation deduplication correctly', async () => {
    const mockOnToast = vi.fn()
    render(
      <Settings
        open={true}
        onClose={() => {}}
        config={defaultConfig}
        onConfigChange={mockOnConfigChange}
        onDictionaryChange={mockOnDictionaryChange}
        onDifficultyChange={mockOnDifficultyChange}
        onResetStats={mockOnResetStats}
        onToast={mockOnToast}
        openToCurate={false}
      />
    )
    
    // Setup mock fetch response with duplicates and invalid length words
    const mockApiResponse = {
      content: [
        {
          text: JSON.stringify(["APPLE", "APPLE", "BERRY", "ROBOT", "TOOOOLONG", "CAT"])
        }
      ]
    }
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse
    })

    // Reveal curation UI first
    const curateTabButton = screen.getByText('AI Curation')
    fireEvent.click(curateTabButton)

    // Type API key and trigger curation
    const apiKeyInput = await screen.findByPlaceholderText('sk-ant-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test-key' } })
    
    const curateButton = screen.getByText('Start Curation')
    fireEvent.click(curateButton)
    
    expect(curateButton.textContent).toBe('Curating\u2026')
    
    await waitFor(() => {
      // Second arg is the optional toast action — absent here because there was no
      // previous list to undo back to.
      expect(mockOnToast).toHaveBeenCalledWith(expect.stringContaining('Custom list curated'), undefined)
    })
    
    // Deduplication should result in only valid 5-letter words: APPLE, BERRY, ROBOT
    // Duplicates are removed, too long / too short are removed
    const storedDict = JSON.parse(localStorage.getItem('lexi5_custom_dict'))
    expect(storedDict.sort()).toEqual(['apple', 'berry', 'robot'])
    expect(storedDict.length).toBe(3)
  })

  it('lets the Word Count field go blank instead of snapping to 0 when cleared', () => {
    render(
      <Settings
        open={true}
        onClose={() => {}}
        config={defaultConfig}
        onConfigChange={mockOnConfigChange}
        onDictionaryChange={mockOnDictionaryChange}
        onDifficultyChange={mockOnDifficultyChange}
        onResetStats={mockOnResetStats}
        openToCurate={false}
      />
    )

    fireEvent.click(screen.getByText('AI Curation'))

    const wordCountInput = screen.getByLabelText('Word Count')
    // Number('') is 0 (a finite number), not NaN — a naive `Number.isFinite` guard would
    // let that slip through and snap the field to "0" the instant it's cleared, instead
    // of letting the player actually retype a fresh count.
    fireEvent.change(wordCountInput, { target: { value: '' } })
    expect(wordCountInput.value).toBe('')

    fireEvent.change(wordCountInput, { target: { value: '250' } })
    expect(wordCountInput.value).toBe('250')
  })

  it('reports a curation timeout distinctly from a user cancel', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    try {
      render(
        <Settings
          open={true}
          onClose={() => {}}
          config={defaultConfig}
          onDictionaryChange={mockOnDictionaryChange}
          resetStats={mockOnResetStats}
          onToast={vi.fn()}
        />
      )

      // A request that never settles, so only the 30s timeout can end it.
      global.fetch.mockImplementation((_url, opts) => new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }))

      fireEvent.click(screen.getByText('AI Curation'))
      fireEvent.change(screen.getByPlaceholderText('sk-ant-...'), { target: { value: 'sk-ant-test-key' } })
      fireEvent.click(screen.getByText('Start Curation'))

      await act(async () => { vi.advanceTimersByTime(30000) })

      expect(screen.getByText('Curation timed out after 30s. Please try again.')).toBeTruthy()
      expect(localStorage.getItem('lexi5_custom_dict')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets the player cancel a running curation without showing it as an error', async () => {
    const mockOnToast = vi.fn()
    render(
      <Settings
        open={true}
        onClose={() => {}}
        config={defaultConfig}
        onDictionaryChange={mockOnDictionaryChange}
        resetStats={mockOnResetStats}
        onToast={mockOnToast}
      />
    )

    global.fetch.mockImplementation((_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))

    fireEvent.click(screen.getByText('AI Curation'))
    fireEvent.change(screen.getByPlaceholderText('sk-ant-...'), { target: { value: 'sk-ant-test-key' } })
    fireEvent.click(screen.getByText('Start Curation'))

    // The Cancel button only exists while a run is in flight — that reachable abort is
    // the point of the fix; the AbortController already existed.
    fireEvent.click(await screen.findByText('Cancel'))

    await waitFor(() => {
      expect(mockOnToast).toHaveBeenCalledWith('Curation cancelled.')
    })
    // A deliberate cancel is not an error state.
    expect(screen.queryByText(/timed out/i)).toBeNull()
    expect(localStorage.getItem('lexi5_custom_dict')).toBeNull()
  })
})
