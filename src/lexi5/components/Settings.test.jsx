// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { Settings } from './Settings'

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
  SettingsToggle: ({ label, description, checked, onChange, disabled }) => (
    <div data-testid="settings-toggle">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={e => onChange(e.target.checked)} 
        disabled={disabled}
      />
      <span>{label}</span>
      <span>{description}</span>
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
    
    expect(curateButton.textContent).toBe('Curating...')
    
    await waitFor(() => {
      expect(mockOnToast).toHaveBeenCalledWith(expect.stringContaining('Custom list curated'))
    })
    
    // Deduplication should result in only valid 5-letter words: APPLE, BERRY, ROBOT
    // Duplicates are removed, too long / too short are removed
    const storedDict = JSON.parse(localStorage.getItem('lexi5_custom_dict'))
    expect(storedDict.sort()).toEqual(['apple', 'berry', 'robot'])
    expect(storedDict.length).toBe(3)
  })

  it('handles curation timeout (AbortError)', async () => {
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
    
    // Simulate AbortError for timeout
    global.fetch.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'))

    const curateTabButton = screen.getByText('AI Curation')
    fireEvent.click(curateTabButton)

    const apiKeyInput = await screen.findByPlaceholderText('sk-ant-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test-key' } })
    
    const curateButton = screen.getByText('Start Curation')
    fireEvent.click(curateButton)
    
    await waitFor(() => {
      expect(screen.getByText('Curation timed out after 30s. Please try again.')).toBeTruthy()
    })
    
    // Ensure nothing was saved
    expect(localStorage.getItem('lexi5_custom_dict')).toBeNull()
  })
})
