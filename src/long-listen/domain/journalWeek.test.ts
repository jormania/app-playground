import { describe, it, expect } from 'vitest'
import { journalWeek } from './journalWeek'
import type { ProgrammeOption, WeekRecord } from './types'

const option = (id: string, status: ProgrammeOption['status'], weekKey = '2026-W42'): ProgrammeOption => ({
  id, weekKey, position: 1, mood: 'immersive', title: id, pitch: '', character: [], why: '', angle: '', status,
})
const week = (w: Partial<WeekRecord>): WeekRecord => ({
  weekKey: '2026-W42', startsOn: '2026-10-12', endsOn: '2026-10-18', createdAt: 'x', optionIds: [], setAsideProgrammeIds: [], promptVersion: 'v', ...w,
})

describe('a Journal week: what it says was offered', () => {
  it('leaves out directions reworked for new settings: their reworkings are the ones listed', () => {
    const opts = [option('a', 'reworked'), option('b', 'reworked'), option('a2', 'chosen'), option('b2', 'open')]
    const view = journalWeek(week({ earlierOptionIds: ['a', 'b'], optionIds: ['a2', 'b2'], chosenOptionId: 'a2', programmeId: 'p' }), new Map(opts.map((o) => [o.id, o])))
    expect(view.others.map((o) => o.id)).toEqual(['b2'])
    expect(view.choice).toEqual({ kind: 'chosen' })
  })

  it('leaves out a direction set aside this week, which its "set aside" line names — but keeps one set aside in another week', () => {
    const opts = [option('a', 'set-aside'), option('b', 'chosen'), option('c', 'open'), option('old', 'set-aside', '2026-W41')]
    const programmes = [{ id: 'pa', optionId: 'a' }, { id: 'pb', optionId: 'b' }, { id: 'pold', optionId: 'old' }]
    const view = journalWeek(week({ optionIds: ['a', 'b', 'c'], chosenOptionId: 'b', programmeId: 'pb', setAsideProgrammeIds: ['pa'] }), new Map(opts.map((o) => [o.id, o])), programmes)
    expect(view.others.map((o) => o.id)).toEqual(['c'])
    // In the week that offered it, a set-aside path taken elsewhere is still said.
    const w41 = journalWeek(week({ weekKey: '2026-W41', optionIds: ['old'] }), new Map(opts.map((o) => [o.id, o])), programmes)
    expect(w41.others.map((o) => o.id)).toEqual(['old'])
  })

  it('no longer counts the directions chosen from', () => {
    const opts = [option('a', 'chosen'), option('b', 'open'), option('c', 'open')]
    expect(journalWeek(week({ optionIds: ['a', 'b', 'c'], chosenOptionId: 'a', programmeId: 'p' }), new Map(opts.map((o) => [o.id, o]))).choice).toEqual({ kind: 'chosen' })
  })
})
