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
})
