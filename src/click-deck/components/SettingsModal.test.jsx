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
})
