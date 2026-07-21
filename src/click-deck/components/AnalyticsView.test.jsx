/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AnalyticsView } from './AnalyticsView'

describe('AnalyticsView', () => {
  afterEach(() => cleanup())

  const mockGames = [
    { id: '1', title: 'Monkey Island', year: 1990, status: 'Completed', tags: ['SCUMM', 'Pirates'] },
    { id: '2', title: 'Grim Fandango', year: 1998, status: 'Playing', tags: ['3D', 'Noir', 'Comedy'] },
    { id: '3', title: 'Day of the Tentacle', year: 1993, status: 'Completed', tags: ['SCUMM', 'Comedy'] }
  ]

  it('renders global tag matrix word cloud', () => {
    const setActiveTags = vi.fn()

    render(
      <AnalyticsView
        filteredGames={mockGames}
        activeTags={[]}
        setActiveTags={setActiveTags}
      />
    )

    expect(screen.getByText('TAG_MATRIX')).toBeTruthy()
    // Check tags exist
    expect(screen.getByText(/SCUMM/i)).toBeTruthy()
    expect(screen.getByText(/Comedy/i)).toBeTruthy()
    expect(screen.getByText(/Pirates/i)).toBeTruthy()
  })

  it('displays the correct number of matching entries', () => {
    const setActiveTags = vi.fn()

    render(
      <AnalyticsView
        filteredGames={mockGames}
        activeTags={[]}
        setActiveTags={setActiveTags}
      />
    )

    expect(screen.getByText('MATCHING ENTRIES: 3')).toBeTruthy()
    expect(screen.getByText('Monkey Island')).toBeTruthy()
    expect(screen.getByText('Grim Fandango')).toBeTruthy()
  })

  it('calls setActiveTags when a tag is clicked', () => {
    const setActiveTags = vi.fn()

    render(
      <AnalyticsView
        filteredGames={mockGames}
        activeTags={[]}
        setActiveTags={setActiveTags}
      />
    )

    // The component renders "SCUMM (2)" where "SCUMM " is the tag text.
    // It's safer to get it by text using regex
    fireEvent.click(screen.getByText(/SCUMM/i))
    expect(setActiveTags).toHaveBeenCalledWith(['SCUMM'])
  })

  it('applies the correct status colour class per game in the gallery grid', () => {
    const withStatuses = [
      { id: '1', title: 'A', year: 2000, status: 'Completed', tags: [] },
      { id: '2', title: 'B', year: 2001, status: 'Playing', tags: [] },
      { id: '3', title: 'C', year: 2002, status: 'Abandoned', tags: [] },
      { id: '4', title: 'D', year: 2003, status: 'Backlog', tags: [] }
    ]
    render(<AnalyticsView filteredGames={withStatuses} activeTags={[]} setActiveTags={() => {}} />)

    expect(screen.getByText('[Completed]').style.color).toBe('var(--cd-status-completed)')
    expect(screen.getByText('[Playing]').style.color).toBe('var(--cd-status-playing)')
    expect(screen.getByText('[Abandoned]').style.color).toBe('var(--cd-status-abandoned)')
    expect(screen.getByText('[Backlog]').style.color).toBe('var(--cd-status-backlog)')
  })
})
