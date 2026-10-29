// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ProposedRecording, Recording } from '../domain/types'

vi.mock('../app/services', () => ({ useServices: () => ({ spotify: { connected: true }, repo: {}, bump: () => {}, say: () => {} }) }))
vi.mock('../app/playback', () => ({ usePlayback: () => ({}) }))
const { RecordingBlock } = await import('./RecordingBlock')

afterEach(cleanup)

const gielen: ProposedRecording = { composer: 'György Ligeti', work: 'Atmosphères', conductor: 'Michael Gielen', orchestra: 'SWR Sinfonieorchester Baden-Baden', soloists: [] }
const missing: Recording = { id: 'r', workId: 'w', soloistIds: [], character: ['dense', 'slow-moving', 'atmospheric'], verification: 'not-found', checkedWith: 99 }

describe('a recording Spotify doesn’t carry', () => {
  // 29 October 2026: its tags, a search and a long note sat above the stand-in that actually plays.
  it('steps back to one line when a stand-in plays below it', () => {
    const { container } = render(<RecordingBlock proposed={gielen} recording={missing} standInBelow />)
    expect(container.textContent).toBe('The curator’s choice, Michael Gielen · SWR Sinfonieorchester Baden-Baden, isn’t on Spotify. This one plays in its place:')
    expect(container.querySelector('a')).toBeNull()
  })

  it('keeps its tags and the search while nothing plays in its place', () => {
    const { container } = render(<RecordingBlock proposed={gielen} recording={missing} />)
    expect(container.textContent).toContain('dense')
    expect(container.textContent).toContain('Look for it on Spotify')
  })
})
