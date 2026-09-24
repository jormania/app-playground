import { describe, expect, it } from 'vitest'
import { buildReport, cueFor } from './feedback'
import { Judge } from './judge'
import { DEFAULT_SETTINGS, type JudgeSettings } from './settings'

/** A mode where the song runs on a clock, so timing, early/late and missed notes exist. */
const RUNNING: JudgeSettings = { ...DEFAULT_SETTINGS, onWrong: 'show' }
import { odeToJoy, songOf } from './testing/songs'

function runPerfect(settings: JudgeSettings) {
  const j = new Judge(odeToJoy, { practice: 'both', settings })
  j.start(0)
  for (const n of odeToJoy.notes) j.press(n.pitch, n.startMs)
  return j.summary()
}

describe('cueFor', () => {
  it('shows mistakes live in “show it” and “wait for it”, never in “keep going”', () => {
    const wrong = { type: 'wrong' as const, wrong: { pitch: 61, atMs: 0, bar: 0 } }
    expect(cueFor(wrong, DEFAULT_SETTINGS)).toEqual({ flashWrong: 61 })
    expect(cueFor(wrong, { ...DEFAULT_SETTINGS, onWrong: 'wait' })).toEqual({ flashWrong: 61 })
    expect(cueFor(wrong, { ...DEFAULT_SETTINGS, onWrong: 'keepGoing' })).toBeNull()
  })
})

describe('buildReport', () => {
  it('leads with what went right, and gives three stars for a clean piece', () => {
    const r = buildReport(runPerfect(RUNNING), RUNNING)
    expect(r).toMatchObject({ stars: 3, score: 1, hit: 15, total: 15, missed: 0, wrong: 0, toWorkOn: [] })
    expect(r.highlights.map((h) => h.kind)).toEqual(['finished', 'notes', 'streak', 'onTime', 'cleanBars'])
  })

  it('always gives a star for finishing, and does not count wrong notes against it by default', () => {
    const j = new Judge(songOf([[60, 0], [62, 500], [64, 1000]]), { practice: 'both', settings: { ...DEFAULT_SETTINGS, onWrong: 'wait' } })
    for (const p of [61, 61, 61, 60, 63, 62, 65, 64]) j.press(p, 0)
    const lenient = buildReport(j.summary(), { ...DEFAULT_SETTINGS, onWrong: 'wait' })
    expect(lenient).toMatchObject({ stars: 3, wrong: 5 })
    const strict = buildReport(j.summary(), { ...DEFAULT_SETTINGS, onWrong: 'wait', wrongAffectsStars: true })
    expect(strict.stars).toBe(1) // 3 of (3 + 5) — still a star for finishing
  })

  it('gives no stars for an abandoned piece', () => {
    const j = new Judge(odeToJoy, { practice: 'both', settings: RUNNING })
    j.start(0)
    j.press(64, 0)
    expect(buildReport(j.summary(), RUNNING).stars).toBe(0)
  })

  it('names one bar to work on in a short report, every troubled bar in a detailed one, none when off', () => {
    const song = songOf([[60, 0], [62, 500], [64, 2000], [65, 2500], [67, 4000]])
    const j = new Judge(song, { practice: 'both', settings: RUNNING })
    j.start(0)
    j.press(60, 0)
    j.press(62, 500) // bar 0 clean
    j.press(70, 2100) // bar 1: wrong key…
    j.tick(9999) // …and both its notes missed; bar 2 missed too
    const short = buildReport(j.summary(), RUNNING)
    expect(short.toWorkOn.map((b) => b.bar)).toEqual([1])
    const detailed = buildReport(j.summary(), { ...RUNNING, report: 'detailed' })
    expect(detailed.toWorkOn.map((b) => [b.bar, b.missed, b.wrong])).toEqual([
      [1, 2, 1],
      [2, 1, 0],
    ])
    expect(buildReport(j.summary(), { ...RUNNING, report: 'off' }).toWorkOn).toEqual([])
    expect(short.highlights).toContainEqual({ kind: 'cleanBars', bars: [0] })
  })

  it('suggests the next rung of the ramp after a piece that went very well, one setting at a time', () => {
    const next = (onWrong: 'wait' | 'show' | 'keepGoing', timing: 'relaxed' | 'normal' | 'strict') => {
      const s = { ...DEFAULT_SETTINGS, onWrong, timing }
      return buildReport(runPerfect(s), s).suggestion
    }
    expect(next('wait', 'relaxed')).toEqual({ setting: 'onWrong', to: 'show' })
    expect(next('show', 'relaxed')).toEqual({ setting: 'timing', to: 'normal' })
    expect(next('show', 'normal')).toEqual({ setting: 'onWrong', to: 'keepGoing' })
    expect(next('keepGoing', 'normal')).toEqual({ setting: 'timing', to: 'strict' })
    expect(next('keepGoing', 'strict')).toBeNull()
    // Off the ladder, set by hand: the next useful change.
    expect(next('keepGoing', 'relaxed')).toEqual({ setting: 'timing', to: 'normal' })
    expect(next('show', 'strict')).toEqual({ setting: 'onWrong', to: 'keepGoing' })
  })

  it('starts a new player on “Wait for it”, relaxed', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ onWrong: 'wait', timing: 'relaxed', wrongAffectsStars: false })
  })

  it('does not suggest anything after a piece that went only fairly well', () => {
    const j = new Judge(odeToJoy, { practice: 'both', settings: RUNNING })
    j.start(0)
    odeToJoy.notes.slice(0, 12).forEach((n) => j.press(n.pitch, n.startMs))
    j.tick(99_999)
    const r = buildReport(j.summary(), RUNNING)
    expect(r).toMatchObject({ stars: 2, suggestion: null })
  })
})
