import { describe, expect, it } from 'vitest'
import type { Session } from '../domain/types'
import { parseCsv } from './csv'
import {
  detectFormat, exportCsv, exportJson, normaliseRecord, parseDuration, planImport, previewImport,
} from './importExport'

const NOW = '2026-11-20T10:00:00.000Z'
const A = 'aaaaaaaaaaa'
const B = 'bbbbbbbbbbb'
const C = 'ccccccccccc'

function existing(id: string, videoId: string, over: Partial<Session> = {}): Session {
  return {
    id, title: `Existing ${id}`, instructor: 'Yoga With Adriene', youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    youtubeVideoId: videoId, thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, durationMinutes: 20, styles: ['Hatha'], intensity: 2, physicalFocus: ['Hips'],
    objectives: [], energy: [], experienceLevel: [], timeOfDay: [], equipment: [], tags: [],
    classificationConfidence: 'high', classificationSource: 'manual', dateAdded: '2026-01-01T00:00:00Z',
    description: 'Kept description', ...over,
  }
}

describe('csv', () => {
  it('parses quotes, embedded commas, doubled quotes, CRLF and a BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n"multi\nline",z\n')).toEqual([
      ['a', 'b'], ['x, y', 'say "hi"'], ['multi\nline', 'z'],
    ])
  })
})

describe('parseDuration', () => {
  it.each([[22, 22], ['22', 22], ['22.6', 23], ['22:30', 23], ['1:02:30', 63], ['0:40', 1]])('%s → %s', (input, out) => {
    expect(parseDuration(input)).toBe(out)
  })
  it.each([[''], ['soon'], [0], ['-5'], ['1:xx']])('rejects %s', (input) => {
    expect(parseDuration(input)).toBeNull()
  })
})

describe('normaliseRecord', () => {
  it('derives only the canonical URL, video id and thumbnail; invents nothing else', () => {
    const { session, errors } = normaliseRecord({ title: 'Hips', youtubeUrl: `https://youtu.be/${A}`, durationMinutes: '20' }, NOW)
    expect(errors).toEqual([])
    expect(session).toMatchObject({
      id: `yt-${A}`, youtubeVideoId: A, youtubeUrl: `https://www.youtube.com/watch?v=${A}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${A}/hqdefault.jpg`, intensity: 0, styles: [], physicalFocus: [],
      classificationConfidence: 'low', classificationSource: 'inferred', dateAdded: NOW,
    })
  })

  it('requires title, a valid video and a duration', () => {
    const { session, errors } = normaliseRecord({ youtubeUrl: 'https://vimeo.com/1' }, NOW)
    expect(session).toBeUndefined()
    expect(errors).toEqual(['Missing title', 'YouTube URL or video id is not valid', 'Missing or unreadable duration'])
  })

  it('rejects a URL and id that disagree', () => {
    const { errors } = normaliseRecord({ title: 'x', youtubeVideoId: A, youtubeUrl: `https://youtu.be/${B}`, durationMinutes: 5 }, NOW)
    expect(errors).toContain('youtubeUrl and youtubeVideoId point to different videos')
  })

  it('canonicalises vocabulary, keeps unknown values and extra columns with warnings', () => {
    const { session, warnings } = normaliseRecord({
      title: 'x', youtubeVideoId: A, durationMinutes: 10, styles: 'hatha | Acro', intensity: '9', mood: 'sunny',
    }, NOW)
    expect(session?.styles).toEqual(['Hatha', 'Acro'])
    expect(session?.intensity).toBe(0)
    expect(session?.extra).toEqual({ mood: 'sunny' })
    expect(warnings.join('\n')).toMatch(/Unrecognised styles: Acro/)
    expect(warnings.join('\n')).toMatch(/not 1–5/)
    expect(warnings.join('\n')).toMatch(/extra field/)
  })
})

describe('previewImport and duplicate detection', () => {
  const catalogue = [existing('mine', A)]

  it('flags duplicates against the catalogue and within the file, by video id', () => {
    const json = JSON.stringify([
      { title: 'Same as mine', youtubeUrl: `https://www.youtube.com/watch?v=${A}`, durationMinutes: 30 },
      { title: 'New one', youtubeVideoId: B, durationMinutes: 15 },
      { title: 'New one again', youtubeUrl: `https://youtu.be/${B}`, durationMinutes: 15 },
      { title: 'Broken' },
    ])
    const { rows, fatal } = previewImport(json, 'json', catalogue, NOW)
    expect(fatal).toBeUndefined()
    expect(rows.map((r) => r.status)).toEqual(['duplicate', 'new', 'invalid', 'invalid'])
    expect(rows[0].duplicateOf).toBe('mine')
    expect(rows[2].duplicateInFile).toBe(1)
  })

  it('reports unreadable files instead of throwing', () => {
    expect(previewImport('{nope', 'json', [], NOW).fatal).toBeTruthy()
    expect(previewImport('{"x":1}', 'json', [], NOW).fatal).toMatch(/sessions/)
    expect(previewImport('title\n', 'csv', [], NOW).fatal).toMatch(/no records/)
  })

  it('reads CSV with list columns', () => {
    const csv = `title,youtubeUrl,durationMinutes,styles,physicalFocus,intensity\n"Hips, slow",https://youtu.be/${C},22:00,Yin Yoga|Restorative,Hips;Lower back,1\n`
    const { rows } = previewImport(csv, 'csv', [], NOW)
    expect(rows[0].session).toMatchObject({ title: 'Hips, slow', durationMinutes: 22, styles: ['Yin Yoga', 'Restorative'], physicalFocus: ['Hips', 'Lower back'], intensity: 1 })
  })

  it('detects format from the name, then the content', () => {
    expect(detectFormat('a.CSV', '[')).toBe('csv')
    expect(detectFormat('x', '  [{}]')).toBe('json')
    expect(detectFormat('x', 'title,url')).toBe('csv')
  })
})

describe('planImport', () => {
  const catalogue = [existing('mine', A)]
  const preview = previewImport(JSON.stringify([
    { title: 'Updated title', youtubeVideoId: A, durationMinutes: 31, styles: [] },
    { title: 'Fresh', youtubeVideoId: B, durationMinutes: 10 },
    { title: '' },
  ]), 'json', catalogue, NOW)

  it('skip leaves existing records alone', () => {
    const plan = planImport(preview, catalogue, 'skip')
    expect(plan).toMatchObject({ added: 1, skipped: 1, invalid: 1, updated: 0, replaced: 0 })
    expect(plan.write.map((s) => s.id)).toEqual([`yt-${B}`])
  })

  it('update fills in non-empty values and keeps id, date added and existing fields', () => {
    const plan = planImport(preview, catalogue, 'update')
    const updated = plan.write.find((s) => s.id === 'mine')!
    expect(updated).toMatchObject({
      title: 'Updated title', durationMinutes: 31, styles: ['Hatha'], intensity: 2,
      description: 'Kept description', dateAdded: '2026-01-01T00:00:00Z',
    })
    expect(plan.updated).toBe(1)
  })

  it('replace takes the incoming record but keeps the existing id', () => {
    const plan = planImport(preview, catalogue, 'replace')
    const replaced = plan.write.find((s) => s.id === 'mine')!
    expect(replaced.styles).toEqual([])
    expect(replaced.description).toBeUndefined()
    expect(plan.replaced).toBe(1)
  })
})

describe('export round-trip', () => {
  it('JSON and CSV exports re-import to the same sessions', () => {
    const sessions = [
      existing('one', A, { tags: ['a, b', 'c'], extra: { mood: 'sunny' } }),
      existing('two', B, { styles: ['Yin Yoga', 'Restorative'], description: 'Line one\nline "two"' }),
    ]
    const fromJson = previewImport(exportJson(sessions), 'json', [], NOW).rows.map((r) => r.session)
    expect(fromJson).toEqual(sessions)
    const fromCsv = previewImport(exportCsv(sessions), 'csv', [], NOW).rows.map((r) => r.session)
    expect(fromCsv[1]).toEqual(sessions[1])
    expect(fromCsv[0]?.extra).toEqual({ mood: 'sunny' })
  })
})
