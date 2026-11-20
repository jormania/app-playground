import { describe, expect, it, vi } from 'vitest'
import { normaliseRecord, previewImport } from './importExport'
import {
  isPractice, minutesFromTitle, readTitle, scanChannel, seriesFromTitle, videoToRecord, type ChannelPage, type ChannelVideo,
} from './channel'

const v = (id: string, over: Partial<ChannelVideo> = {}): ChannelVideo => ({
  videoId: id.padEnd(11, 'x').slice(0, 11), title: `Video ${id}`, description: '', publishedAt: '2026-11-01T10:00:00Z', durationSeconds: 1200, ...over,
})

describe('reading a title', () => {
  it('finds style, body area, objectives and a provisional intensity', () => {
    expect(readTitle('Yoga For Lower Back Pain | 20 Minute Gentle Practice')).toMatchObject({
      styles: ['Gentle Yoga'], physicalFocus: ['Lower back'], intensity: 2,
    })
    expect(readTitle('Bedtime Yoga | Yoga for Sleep')).toMatchObject({ styles: ['Evening Yoga'], timeOfDay: ['Before bed'], intensity: 1 })
    expect(readTitle('Power Yoga for Strength').intensity).toBe(4)
    expect(readTitle('Yoga for Hip Flexors').physicalFocus).toEqual(['Hip flexors'])
    expect(readTitle('Yoga For Complete Beginners').experienceLevel).toEqual(['Beginner'])
  })

  it('says nothing it cannot see', () => {
    expect(readTitle('Day 12 - Soften')).toEqual({ styles: [], physicalFocus: [], objectives: [], timeOfDay: [], experienceLevel: [], intensity: 0 })
    // Words inside other words don't count.
    expect(readTitle('Coreopsis and Yinyang').styles).toEqual([])
    expect(readTitle('Shipwreck').physicalFocus).toEqual([])
  })

  it('reads the series and day only when both are plainly in the title', () => {
    // Real formats are covered exhaustively in channel.titles.test.ts; these are the edges.
    expect(seriesFromTitle('Day 8 - Rest  |  MOVE - A 30 Day Yoga Journey')).toEqual({ series: 'MOVE', day: 8 })
    expect(seriesFromTitle('Return - 2 - Ground')).toEqual({ series: 'RETURN', day: 2 })
    expect(seriesFromTitle('TRUE - Day 12 - CENTER  |  Yoga With Adriene')).toEqual({ series: 'TRUE', day: 12 })
    expect(seriesFromTitle('Day 3 - Yoga to move your body at home')).toBeNull()
    expect(seriesFromTitle('MOVEMENT Day 3')).toBeNull()
    expect(seriesFromTitle('Intro to Prana 7-Day Yoga Series')).toBeNull()
    expect(seriesFromTitle('Flow - Day 0 - Ready')).toBeNull()
    expect(seriesFromTitle('Prana - Day 8 Bonus!')).toBeNull()
  })

  it('reads minutes from a title only as a fallback', () => {
    expect(minutesFromTitle('20 Minute Yoga')).toBe(20)
    expect(minutesFromTitle('Yoga for Runners - 15-Min')).toBe(15)
    expect(minutesFromTitle('Yoga 30 Days')).toBeNull()
    expect(minutesFromTitle('0 minutes')).toBeNull()
  })
})

describe('video → catalogue record', () => {
  it('takes facts from YouTube and marks everything read from the title as provisional', () => {
    const raw = videoToRecord(v('aaa', { title: 'Center - Day 4 - Root', durationSeconds: 1330 }))
    const { session, errors } = normaliseRecord(raw, 'now')
    expect(errors).toEqual([])
    expect(session).toMatchObject({
      id: 'yt-aaaxxxxxxxx', durationMinutes: 22, publishedDate: '2026-11-01', series: 'CENTER', seriesDay: 4,
      classificationConfidence: 'low', classificationSource: 'inferred', tags: ['from-channel'],
      thumbnailUrl: 'https://i.ytimg.com/vi/aaaxxxxxxxx/hqdefault.jpg',
    })
  })

  it('a feed video with no duration falls back to the title, then refuses rather than guess', () => {
    expect(normaliseRecord(videoToRecord(v('b', { title: '20 Minute Flow', durationSeconds: null })), 'now').session?.tags)
      .toEqual(['from-channel', 'duration-from-title'])
    expect(normaliseRecord(videoToRecord(v('c', { title: 'A new practice', durationSeconds: null })), 'now').errors)
      .toContain('No length: add minutes, like 22 or 22:30')
  })

  it('leaves shorts out but keeps videos with unknown length for review', () => {
    expect(isPractice(v('d', { durationSeconds: 59 }))).toBe(false)
    expect(isPractice(v('e', { durationSeconds: 600 }))).toBe(true)
    expect(isPractice(v('f', { durationSeconds: null }))).toBe(true)
  })

  it('re-checking the channel finds nothing new to add', () => {
    const records = [v('g'), v('h')].map((x) => videoToRecord(x))
    const first = previewImport(JSON.stringify(records), 'json', [], 'now')
    const library = first.rows.map((r) => r.session!)
    const again = previewImport(JSON.stringify(records), 'json', library, 'now')
    expect(again.rows.map((r) => r.status)).toEqual(['duplicate', 'duplicate'])
  })
})

describe('scanning the channel', () => {
  const pages: ChannelPage[] = [
    { source: 'api', videos: [v('n1'), v('n2')], nextPageToken: 'p2', total: 6 },
    { source: 'api', videos: [v('k1'), v('k2')], nextPageToken: 'p3', total: 6 },
    { source: 'api', videos: [v('k3'), v('k4')], nextPageToken: null, total: 6 },
  ]
  const fetchPage = () => {
    const f = vi.fn(async (token: string | null) => pages[token === null ? 0 : token === 'p2' ? 1 : 2])
    return f
  }
  const known = new Set(['k1', 'k2', 'k3', 'k4'].map((id) => v(id).videoId))

  it('an update check stops at the first page of videos already in the library', async () => {
    const f = fetchPage()
    const progress: number[] = []
    const r = await scanChannel({ mode: 'updates', knownIds: known, fetchPage: f, onProgress: (n) => progress.push(n) })
    expect(f).toHaveBeenCalledTimes(2)
    expect(r.caughtUp).toBe(true)
    expect(progress).toEqual([2, 4])
  })

  it('a full import reads to the end', async () => {
    const f = fetchPage()
    const r = await scanChannel({ mode: 'all', knownIds: known, fetchPage: f })
    expect(f).toHaveBeenCalledTimes(3)
    expect(r.read).toBe(6)
    expect(r.total).toBe(6)
  })

  it('never loops forever on a channel that always has another page', async () => {
    const f = vi.fn(async () => ({ source: 'api' as const, videos: [v(`z${Math.random()}`)], nextPageToken: 'again', total: null }))
    await scanChannel({ mode: 'all', knownIds: new Set(), fetchPage: f, maxPages: 5 })
    expect(f).toHaveBeenCalledTimes(5)
  })

  it('passes errors through for the screen to show', async () => {
    await expect(scanChannel({ mode: 'all', knownIds: new Set(), fetchPage: async () => { throw new Error('quota') } })).rejects.toThrow('quota')
  })
})
