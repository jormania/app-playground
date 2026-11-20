// The series matcher against the channel's real titles, not examples I made up.
// Every January journey day must land in its own series with its own number;
// nothing else on the channel may be pulled into a series.
import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/ywa-titles.json'
import { seriesFromTitle } from './channel'

const YEAR_SERIES: Record<string, string> = {
  '2015': '30 Days of Yoga', '2016': 'Yoga Camp', '2017': 'Revolution', '2018': 'TRUE', '2019': 'Dedicate',
  '2020': 'HOME', '2021': 'BREATH', '2022': 'MOVE', '2023': 'CENTER', '2024': 'FLOW', '2025': 'PRANA', '2026': 'RETURN',
}
const LENGTH: Record<string, number> = { Revolution: 31, PRANA: 7, RETURN: 4 }

const titles = (fixture as unknown as { titles: [string, string][] }).titles
const isJourneyDay = ([title, date]: [string, string]) =>
  /^\d{4}-0[12]/.test(date) && (/\b(day|week) *\d/i.test(title) || /^Return - \d - /.test(title))

describe('series from the real channel titles', () => {
  const days = titles.filter(isJourneyDay)

  it('covers every journey', () => {
    expect(days.length).toBeGreaterThan(300)
  })

  it.each(days)('%s (%s)', (title, date) => {
    const series = YEAR_SERIES[date.slice(0, 4)]
    const n = Number((/\b(?:day|week) *(\d+)/i.exec(title) ?? /^Return - (\d) /.exec(title))![1])
    const inRange = n >= 1 && n <= (LENGTH[series] ?? 30)
    expect(seriesFromTitle(title)).toEqual(inRange ? { series, day: n } : null)
  })

  it('puts every day of every journey in place, with no gaps', () => {
    const found = new Map<string, Set<number>>()
    for (const [title] of days) {
      const r = seriesFromTitle(title)
      if (r) found.set(r.series, (found.get(r.series) ?? new Set()).add(r.day))
    }
    for (const series of Object.values(YEAR_SERIES)) {
      const len = LENGTH[series] ?? 30
      expect([...(found.get(series) ?? [])].sort((a, b) => a - b), series).toEqual(Array.from({ length: len }, (_, i) => i + 1))
    }
  })

  it('pulls nothing else on the channel into a series', () => {
    const strays = titles.filter((r) => !isJourneyDay(r) && seriesFromTitle(r[0]))
    expect(strays).toEqual([])
  })
})
