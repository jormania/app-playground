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

  describe('tag-count data-quality filter', () => {
    const withTagCounts = [
      { id: '1', title: 'Under', year: 2000, status: 'Backlog', tags: ['A', 'B'] },
      { id: '2', title: 'InRange', year: 2001, status: 'Backlog', tags: ['A', 'B', 'C', 'D', 'E'] },
      { id: '3', title: 'Over', year: 2002, status: 'Backlog', tags: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }
    ]

    it('shows only entries with fewer than 5 tags under "Under 5"', () => {
      render(<AnalyticsView filteredGames={withTagCounts} activeTags={[]} setActiveTags={() => {}} />)
      fireEvent.click(screen.getByText('Under 5'))
      expect(screen.getByText('MATCHING ENTRIES: 1')).toBeTruthy()
      expect(screen.getByText('Under')).toBeTruthy()
    })

    it('shows only entries with more than 7 tags under "Over 7"', () => {
      render(<AnalyticsView filteredGames={withTagCounts} activeTags={[]} setActiveTags={() => {}} />)
      fireEvent.click(screen.getByText('Over 7'))
      expect(screen.getByText('MATCHING ENTRIES: 1')).toBeTruthy()
      expect(screen.getByText('Over')).toBeTruthy()
    })
  })

  describe('JSON export', () => {
    it('downloads a JSON blob of the currently filtered entries', () => {
      const createObjectURL = vi.fn(() => 'blob:mock')
      const revokeObjectURL = vi.fn()
      const originalCreate = global.URL.createObjectURL
      const originalRevoke = global.URL.revokeObjectURL
      global.URL.createObjectURL = createObjectURL
      global.URL.revokeObjectURL = revokeObjectURL
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      render(<AnalyticsView filteredGames={mockGames} activeTags={[]} setActiveTags={() => {}} />)
      fireEvent.click(screen.getByText('[EXPORT JSON]'))

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const [blobArg] = createObjectURL.mock.calls[0]
      expect(blobArg.type).toBe('application/json')
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')

      clickSpy.mockRestore()
      global.URL.createObjectURL = originalCreate
      global.URL.revokeObjectURL = originalRevoke
    })

    it('includes Completed At and Length (hrs) in the exported JSON', () => {
      const originalBlob = global.Blob
      let capturedParts = null
      global.Blob = class {
        constructor(parts) { capturedParts = parts }
      }
      const createObjectURL = vi.fn(() => 'blob:mock')
      const originalCreate = global.URL.createObjectURL
      const originalRevoke = global.URL.revokeObjectURL
      global.URL.createObjectURL = createObjectURL
      global.URL.revokeObjectURL = vi.fn()
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      const gamesWithR2Fields = [
        { id: '1', title: 'Pentiment', year: 2022, status: 'Completed', tags: ['RPG'], completedAt: '2026-01-15', lengthHours: 19.2 }
      ]
      render(<AnalyticsView filteredGames={gamesWithR2Fields} activeTags={[]} setActiveTags={() => {}} />)
      fireEvent.click(screen.getByText('[EXPORT JSON]'))

      const exported = JSON.parse(capturedParts[0])
      expect(exported[0].completedAt).toBe('2026-01-15')
      expect(exported[0].lengthHours).toBe(19.2)

      clickSpy.mockRestore()
      global.Blob = originalBlob
      global.URL.createObjectURL = originalCreate
      global.URL.revokeObjectURL = originalRevoke
    })
  })

  describe('HTML export', () => {
    it('includes Length and Completed columns for the exported entries', () => {
      const originalBlob = global.Blob
      let capturedParts = null
      global.Blob = class {
        constructor(parts) { capturedParts = parts }
      }
      const originalCreate = global.URL.createObjectURL
      const originalRevoke = global.URL.revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock')
      global.URL.revokeObjectURL = vi.fn()
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      const gamesWithR2Fields = [
        { id: '1', title: 'Pentiment', year: 2022, status: 'Completed', tags: ['RPG'], completedAt: '2026-01-15', lengthHours: 19.2 }
      ]
      render(<AnalyticsView filteredGames={gamesWithR2Fields} activeTags={[]} setActiveTags={() => {}} />)
      fireEvent.click(screen.getByText('[EXPORT HTML]'))

      const html = capturedParts[0]
      expect(html).toContain('<th>Length</th>')
      expect(html).toContain('<th>Completed</th>')
      expect(html).toContain('19.2h')
      expect(html).toContain('2026-01-15')

      clickSpy.mockRestore()
      global.Blob = originalBlob
      global.URL.createObjectURL = originalCreate
      global.URL.revokeObjectURL = originalRevoke
    })
  })

  describe('gallery cover links', () => {
    it('renders the gallery item as a real link to Steam when an appId is present', () => {
      const withAppId = [{ id: '1', title: 'Monkey Island', year: 1990, status: 'Completed', tags: [], appId: 730820 }]
      render(<AnalyticsView filteredGames={withAppId} activeTags={[]} setActiveTags={() => {}} />)
      const link = document.querySelector('a.cd-gallery-item')
      expect(link).toBeTruthy()
      expect(link.getAttribute('href')).toBe('https://store.steampowered.com/app/730820')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    })

    it('renders the gallery item as a plain non-link element when there is no appId', () => {
      render(<AnalyticsView filteredGames={mockGames} activeTags={[]} setActiveTags={() => {}} />)
      expect(document.querySelector('a.cd-gallery-item')).toBeNull()
      expect(document.querySelectorAll('div.cd-gallery-item').length).toBe(mockGames.length)
    })
  })
})
