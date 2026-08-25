import { describe, expect, it } from 'vitest'
import { DEFAULT_LANG, LANGS, STRINGS, isLang, makeT } from './i18n.js'
import { dayHeading, formatWhen, relativeDays } from './dates.js'
import { viewLabel } from './search.js'
import { signalLabel } from './signals.js'

const ro = makeT('ro')
const en = makeT('en')

describe('language table', () => {
  it('offers exactly the languages the settings picker lists', () => {
    expect(LANGS.map((l) => l.id).sort()).toEqual(Object.keys(STRINGS).sort())
  })

  it('defaults to Romanian', () => {
    expect(DEFAULT_LANG).toBe('ro')
    expect(makeT()('__lang__')).toBe('ro')
  })

  it('recognises only real language ids', () => {
    expect(isLang('ro')).toBe(true)
    expect(isLang('en')).toBe(true)
    expect(isLang('fr')).toBe(false)
    expect(isLang(undefined)).toBe(false)
    // A key that exists on Object.prototype must not pass as a language.
    expect(isLang('toString')).toBe(false)
  })

  it('translates every Romanian key into English', () => {
    const missing = Object.keys(STRINGS.ro).filter((k) => !(k in STRINGS.en))
    expect(missing).toEqual([])
  })

  it('carries no English key the Romanian source lacks', () => {
    const extra = Object.keys(STRINGS.en).filter((k) => !(k in STRINGS.ro))
    expect(extra).toEqual([])
  })

  it('keeps placeholder sets identical across the two tables', () => {
    const slots = (s) => (s.match(/\{(\w+)\}/g) ?? []).sort()
    for (const key of Object.keys(STRINGS.ro)) {
      expect(slots(STRINGS.en[key]), key).toEqual(slots(STRINGS.ro[key]))
    }
  })
})

describe('makeT', () => {
  it('returns the requested language', () => {
    expect(ro('app.refresh')).toBe(STRINGS.ro['app.refresh'])
    expect(en('app.refresh')).toBe(STRINGS.en['app.refresh'])
    expect(ro('app.refresh')).not.toBe(en('app.refresh'))
  })

  it('falls back to Romanian for an unknown language', () => {
    expect(makeT('fr')('app.refresh')).toBe(STRINGS.ro['app.refresh'])
  })

  it('falls back to the key itself when nothing matches', () => {
    expect(en('nope.not.a.key')).toBe('nope.not.a.key')
  })

  it('interpolates named slots', () => {
    expect(en('app.updated', { when: 'today' })).toContain('today')
    expect(ro('date.daysAgo', { n: 3 })).toContain('3')
  })

  it('leaves a slot alone when no value is given for it', () => {
    expect(en('app.updated')).toContain('{when}')
    expect(en('app.updated', {})).toContain('{when}')
  })
})

describe('helpers that take a translator', () => {
  const now = new Date('2026-08-25T12:00:00')

  it('formats dates in the translator’s language', () => {
    const event = { start: '2026-08-25' }
    expect(formatWhen(event, now, ro)).toBe(STRINGS.ro['date.today'])
    expect(formatWhen(event, now, en)).toBe(STRINGS.en['date.today'])
  })

  it('names months in the translator’s language', () => {
    const event = { start: '2026-12-03' }
    expect(formatWhen(event, now, ro)).not.toBe(formatWhen(event, now, en))
  })

  it('headings, relative days, views and signals all switch', () => {
    expect(dayHeading('2026-08-25', now, ro)).toContain(STRINGS.ro['date.todayHeading'])
    expect(dayHeading('2026-08-25', now, en)).toContain(STRINGS.en['date.todayHeading'])
    expect(relativeDays(-3, ro)).not.toBe(relativeDays(-3, en))
    expect(viewLabel('tonight', ro)).not.toBe(viewLabel('tonight', en))
    expect(signalLabel('free', ro)).not.toBe(signalLabel('free', en))
  })

  it('defaults to Romanian when handed no translator', () => {
    expect(dayHeading('2026-08-25', now)).toContain(STRINGS.ro['date.todayHeading'])
    expect(formatWhen({ start: '2026-08-26' }, now)).toBe(STRINGS.ro['date.tomorrow'])
  })
})
