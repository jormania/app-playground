// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { EngagementLog } from './log'
import { ProfileRepo } from './profiles'
import { memoryStore } from './store'
import { DEFAULT_REMINDER, lastPractisedDay, readReminder, REMINDER_KEY, saveReminder, shouldFire, type ReminderState } from './reminder'

const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m)
const state = (over: Partial<ReminderState> = {}): ReminderState => ({ enabled: true, minutes: 17 * 60, language: 'en', practisedDay: '2026-09-28', ...over })

describe('shouldFire', () => {
  it('fires after the chosen time when nobody has played today, and only once a day', () => {
    expect(shouldFire(state(), '', at(16, 59))).toBe(false)
    expect(shouldFire(state(), '', at(17, 0))).toBe(true)
    expect(shouldFire(state(), '2026-09-29', at(18))).toBe(false)
    expect(shouldFire(state(), '2026-09-28', at(18))).toBe(true)
  })

  it('stays quiet when someone has played today, when it is off, or when nothing is known', () => {
    expect(shouldFire(state({ practisedDay: '2026-09-29' }), '', at(18))).toBe(false)
    expect(shouldFire(state({ enabled: false, minutes: null }), '', at(18))).toBe(false)
    expect(shouldFire(undefined, '', at(18))).toBe(false)
  })
})

describe('the worker’s copy of it', () => {
  // public/keypath-notify.js can't import this module: it carries its own. Run both on the same cases.
  const src = readFileSync('public/keypath-notify.js', 'utf8')
  const self: Record<string, unknown> = { addEventListener() {}, sharedNotifyIdb: {} }
  new Function('self', 'importScripts', src)(self, () => {})
  const worker = self.keypathShouldFire as (s: unknown, last: string, now: Date) => boolean

  it('decides exactly as the page does', () => {
    const cases: [ReminderState | undefined, string, Date][] = [
      [state(), '', at(16, 59)],
      [state(), '', at(17)],
      [state(), '2026-09-29', at(20)],
      [state(), '2026-09-28', at(20)],
      [state({ practisedDay: '2026-09-29' }), '', at(20)],
      [state({ enabled: false, minutes: null }), '', at(20)],
      [state({ minutes: 0 }), '', at(0, 1)],
      [undefined, '', at(20)],
    ]
    for (const [s, last, now] of cases) expect(worker(s, last, now), JSON.stringify([s, last, now])).toBe(shouldFire(s, last, now))
  })
})

describe('the reminder setting', () => {
  beforeEach(() => localStorage.clear())

  it('is off at five o’clock until it is turned on, and mends anything odd it finds', () => {
    expect(readReminder()).toEqual(DEFAULT_REMINDER)
    saveReminder({ enabled: true, minutes: 19 * 60 })
    expect(readReminder()).toEqual({ enabled: true, minutes: 1140 })
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ enabled: 'yes', minutes: 99999 }))
    expect(readReminder()).toEqual(DEFAULT_REMINDER)
  })
})

describe('lastPractisedDay', () => {
  it('is the latest day any player on the phone practised', async () => {
    const store = memoryStore()
    const profiles = new ProfileRepo(store)
    const log = new EngagementLog(store)
    const nora = await profiles.create('Nora', '🐺')
    const gabriel = await profiles.create('Gabriel', '🦊')
    expect(await lastPractisedDay(profiles, log)).toBe('')
    await log.add(nora.id, { type: 'session_start' }, new Date(2026, 8, 27, 18))
    await log.add(gabriel.id, { type: 'session_start' }, new Date(2026, 8, 28, 20))
    expect(await lastPractisedDay(profiles, log)).toBe('2026-09-28')
  })
})
