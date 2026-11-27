// Guards the promises Mat Days makes about its own data: nothing invented,
// everything findable, the PWA wired to files that exist.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { DEMO_SESSIONS } from '../data/demo'
import { BUILT_IN_SERIES } from '../data/series'
import { ENERGY, EQUIPMENT, EXPERIENCE, OBJECTIVES, PHYSICAL_FOCUS, STYLES, TIME_OF_DAY } from '../domain/vocabulary'
import { hrefOf, parseRoute, type Route } from '../app/router'

const ROOT = resolve(__dirname, '../../..')

describe('demo records never pose as real videos', () => {
  it.each(DEMO_SESSIONS.map((s) => [s.id, s]))('%s', (_id, s) => {
    expect(s.isDemo).toBe(true)
    expect(s.title.startsWith('Demo · ')).toBe(true)
    expect(s.youtubeVideoId).toBe('')
    expect(s.thumbnailUrl).toBeUndefined()
    expect(s.youtubeUrl.startsWith('https://www.youtube.com/results?search_query=')).toBe(true)
    expect(s.classificationSource).toBe('inferred')
    expect(s.classificationConfidence).toBe('low')
    expect(s.description).toMatch(/not a real video/)
  })

  it('use only the closed vocabularies', () => {
    for (const s of DEMO_SESSIONS) {
      for (const v of s.styles) expect(STYLES).toContain(v)
      for (const v of s.physicalFocus) expect(PHYSICAL_FOCUS).toContain(v)
      for (const v of s.objectives) expect(OBJECTIVES).toContain(v)
      for (const v of s.energy) expect(ENERGY).toContain(v)
      for (const v of s.experienceLevel) expect(EXPERIENCE).toContain(v)
      for (const v of s.timeOfDay) expect(TIME_OF_DAY).toContain(v)
      for (const v of s.equipment) expect(EQUIPMENT).toContain(v)
      expect(s.intensity).toBeGreaterThanOrEqual(1)
      expect(s.intensity).toBeLessThanOrEqual(5)
    }
  })

  it('have unique ids', () => {
    expect(new Set(DEMO_SESSIONS.map((s) => s.id)).size).toBe(DEMO_SESSIONS.length)
  })
})

describe('built-in series are sourced, not invented', () => {
  it('every series cites an https source and carries no day titles or video ids', () => {
    for (const d of BUILT_IN_SERIES) {
      expect(d.sourceUrl, d.name).toMatch(/^https:\/\//)
      expect(Object.keys(d).sort()).toEqual(['blurb', 'id', 'instructor', 'kind', 'length', 'match', 'name', 'sourceUrl', 'unit', 'year'])
      expect(d.match.every((m) => m === m.toLowerCase())).toBe(true)
    }
  })

  it('one journey a year, newest first, ids unique', () => {
    const years = BUILT_IN_SERIES.map((d) => d.year!)
    expect(years).toEqual([...years].sort((a, b) => b - a))
    expect(new Set(years).size).toBe(years.length)
    expect(new Set(BUILT_IN_SERIES.map((d) => d.id)).size).toBe(BUILT_IN_SERIES.length)
  })

  it('includes the series asked for by name, with their published lengths', () => {
    const byName = Object.fromEntries(BUILT_IN_SERIES.map((d) => [d.name, d]))
    expect(byName.MOVE).toMatchObject({ year: 2022, length: 30, kind: 'journey' })
    expect(byName.CENTER).toMatchObject({ year: 2023, length: 30, kind: 'journey' })
    expect(byName.PRANA).toMatchObject({ length: 7, kind: 'short' })
    expect(byName.RETURN).toMatchObject({ length: 4, unit: 'Week', kind: 'short' })
    expect(byName.Revolution.length).toBe(31)
  })
})

describe('routes', () => {
  const routes: Route[] = [
    { name: 'discover' }, { name: 'explore' }, { name: 'surprise' }, { name: 'practice' }, { name: 'collections' },
    { name: 'settings' }, { name: 'series' }, { name: 'session', id: 'yt-abc/def ü' }, { name: 'collection', id: 'c-1' },
    { name: 'seriesDetail', id: 'move-2022' }, { name: 'editor' }, { name: 'editor', id: 'demo-x' },
  ]
  it.each(routes.map((r) => [hrefOf(r), r]))('%s round-trips', (href, r) => {
    expect(parseRoute(href as string)).toEqual(r)
  })
  it('falls back to Discover on anything unknown, and survives broken escapes', () => {
    expect(parseRoute('#/nowhere')).toEqual({ name: 'discover' })
    expect(parseRoute('')).toEqual({ name: 'discover' })
    expect(parseRoute('#/session/%E0%A4%A')).toEqual({ name: 'session', id: '%E0%A4%A' })
  })
})

describe('PWA wiring', () => {
  const html = readFileSync(resolve(ROOT, 'mat-days-react.html'), 'utf8')
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'public/mat-days.webmanifest'), 'utf8'))

  it('the page links the manifest and icons, and its title says Mat Days', () => {
    expect(html).toContain('href="/mat-days.webmanifest"')
    expect(html).toMatch(/<title>Mat Days/)
    for (const href of html.matchAll(/href="(\/mat-days-[^"]+)"/g)) expect(existsSync(resolve(ROOT, 'public', href[1].slice(1))), href[1]).toBe(true)
  })

  it('the manifest is named Mat Days, standalone, with every icon on disk and a maskable one', () => {
    expect(manifest).toMatchObject({ name: 'Mat Days', short_name: 'Mat Days', display: 'standalone' })
    for (const icon of manifest.icons) expect(existsSync(resolve(ROOT, 'public', icon.src.slice(1))), icon.src).toBe(true)
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
    for (const sc of manifest.shortcuts) expect(sc.url.startsWith(manifest.scope)).toBe(true)
  })

  it('is listed in the registry, the build and the docs', () => {
    expect(readFileSync(resolve(ROOT, 'vite.config.js'), 'utf8')).toContain("'mat-days-react.html'")
    expect(readFileSync(resolve(ROOT, 'src/apps-registry.js'), 'utf8')).toContain('"/mat-days.webmanifest"')
  })
})
