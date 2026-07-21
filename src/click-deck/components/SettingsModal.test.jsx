/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent , cleanup } from '@testing-library/react'
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

  it('requires typing RESET to confirm factory reset', () => {
    const onResetDb = vi.fn()
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('nope')
    render(<SettingsModal onClose={() => {}} onSaveToken={() => {}} onResetDb={onResetDb} />)

    fireEvent.click(screen.getByText(/Factory Reset DB State/))
    expect(onResetDb).not.toHaveBeenCalled()

    promptSpy.mockReturnValue('RESET')
    fireEvent.click(screen.getByText(/Factory Reset DB State/))
    expect(onResetDb).toHaveBeenCalled()

    promptSpy.mockRestore()
  })
})
