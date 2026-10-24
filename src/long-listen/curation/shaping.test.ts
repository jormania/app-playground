import { describe, it, expect, beforeEach } from 'vitest'
import { Journey } from './journey'
import { Repo, memoryStore } from '../store/repo'
import type { CuratorClient, ThemesResponse } from './api'
import { shapeOpen, shapedBrief, shapedSlots, emptyShape } from '../domain/shaping'
import { weekAfter, weekOf } from '../domain/week'

function fakeCurator(script: Partial<Record<string, (payload: any, n: number) => unknown>>) {
  const calls: { op: string; payload: any }[] = []
  const client: CuratorClient = {
    async call<T>(op: string, payload: unknown): Promise<T> {
      calls.push({ op, payload })
      const fn = script[op]
      if (!fn) throw new Error(`unexpected curator call: ${op}`)
      return fn(payload, calls.filter((c) => c.op === op).length) as T
    },
  }
  return { client, calls }
}

const MOODS = ['immersive', 'curious', 'adventurous'] as const
const themes = (titles: [string, string, string], shapedFrom: string[] = ['', '', '']): ThemesResponse => ({
  options: MOODS.map((mood, i) => ({ mood, title: titles[i], pitch: 'p', character: ['x'], why: 'w', angle: 'a', shapedFrom: shapedFrom[i] })),
  promptVersion: 'themes@test', model: 'm',
})
// The sketch curator: one sketch per slot asked, numbered so a swap is visibly another.
const sketches = (payload: any, n: number) => ({
  sketches: payload.nudge
    ? [{ ...payload.nudge.sketch, line: `${payload.nudge.sketch.line}, moved` }]
    : payload.slots.map((mood: string) => ({ mood, title: `${mood} sketch ${n}`, line: `${mood} line`, from: 'something new' })),
  promptVersion: 'sketch@test',
})

let clock: Date
let repo: Repo
const at = (iso: string) => { clock = new Date(iso) }
const journey = (client: CuratorClient) => new Journey(repo, client, { now: () => clock })

beforeEach(() => {
  repo = new Repo(memoryStore())
  at('2026-10-24T09:00:00Z') // Saturday, week 43
})

describe('when Shape next week opens', () => {
  it('opens at two thirds heard, a skip counting as done with', () => {
    expect(shapeOpen(['heard', 'not-started', 'not-started'], '2026-10-21', '2026-10-25')).toBe(false)
    expect(shapeOpen(['heard', 'skipped', 'not-started'], '2026-10-21', '2026-10-25')).toBe(true)
    expect(shapeOpen(['skipped', 'skipped', 'not-started'], '2026-10-21', '2026-10-25')).toBe(false)
  })
  it('opens on the week’s last day with one work heard, so a week half listened to still gets it', () => {
    expect(shapeOpen(['heard', 'not-started', 'not-started', 'not-started'], '2026-10-25', '2026-10-25')).toBe(true)
    expect(shapeOpen(['not-started', 'not-started'], '2026-10-25', '2026-10-25')).toBe(false)
  })
  it('knows next week across a year', () => {
    expect(weekAfter(weekOf(new Date('2026-12-23T12:00:00Z'))).key).toBe('2026-W53')
    expect(weekAfter(weekOf(new Date('2027-01-02T12:00:00Z'))).key).toBe('2027-W01')
  })
  it('leaves the adventurous slot to the curator by default', () => {
    expect(shapedSlots(emptyShape('2026-W44', 'x'))).toEqual(['immersive', 'curious'])
  })
})

describe('shaping next week', () => {
  it('sketches the shaped slots for next week, with where and how it should feel', async () => {
    const c = fakeCurator({ sketch: sketches })
    const j = journey(c.client)
    await j.setShape({ where: 'stay', mood: ['quieter'] })
    const shape = await j.sketchNextWeek()
    expect(shape.weekKey).toBe('2026-W44')
    expect(shape.sketches.map((s) => s.mood)).toEqual(['immersive', 'curious'])
    expect(c.calls[0].payload).toMatchObject({ where: 'stay', mood: ['quieter'], slots: ['immersive', 'curious'], week: { key: '2026-W44' } })
  })

  it('swaps one sketch for another and never offers the passed one again', async () => {
    const c = fakeCurator({ sketch: sketches })
    const j = journey(c.client)
    await j.sketchNextWeek()
    const shape = await j.swapSketch('curious')
    expect(shape.passed).toEqual(['curious sketch 1'])
    expect(shape.sketches.find((s) => s.mood === 'curious')!.title).toBe('curious sketch 2')
    expect(c.calls[1].payload.avoid).toEqual(['curious sketch 1', 'immersive sketch 1'])
  })

  it('keeps the listener’s nudge with the redrafted sketch', async () => {
    const c = fakeCurator({ sketch: sketches })
    const j = journey(c.client)
    await j.sketchNextWeek()
    const shape = await j.nudgeSketch('immersive', 'less Germanic')
    const k = shape.sketches.find((s) => s.mood === 'immersive')!
    expect(k).toMatchObject({ line: 'immersive line, moved', nudge: 'less Germanic' })
    expect(c.calls[1].payload.nudge.words).toBe('less Germanic')
  })

  it('handing a slot back to the curator sketches the one it held before', async () => {
    const c = fakeCurator({ sketch: sketches })
    const j = journey(c.client)
    await j.sketchNextWeek()
    await j.setShape({ leftToCurator: 'curious' })
    const shape = await j.sketchNextWeek()
    expect(c.calls[1].payload.slots).toEqual(['adventurous'])
    expect(shapedBrief(shape).sketches.map((s) => s.mood)).toEqual(['immersive', 'adventurous'])
  })

  it('writes next week’s three from the sketches, sets its mood and says where each came from', async () => {
    const c = fakeCurator({
      sketch: sketches,
      themes: (p) => themes(['immersive sketch 1', 'curious sketch 1', 'A surprise'], p.shaped ? ['immersive sketch 1', 'curious sketch 1', ''] : ['', '', '']),
    })
    const j = journey(c.client)
    await j.setShape({ where: 'new', mood: ['shorter'] })
    await j.sketchNextWeek()
    await j.nudgeSketch('curious', 'more choral')
    at('2026-10-26T09:00:00Z') // Monday, week 44
    const week = await j.ensureWeek()
    const call = c.calls.find((x) => x.op === 'themes')!.payload
    expect(call.shaped).toEqual({
      where: 'new',
      sketches: [
        { mood: 'immersive', title: 'immersive sketch 1', line: 'immersive line', nudge: '' },
        { mood: 'curious', title: 'curious sketch 1', line: 'curious line, moved', nudge: 'more choral' },
      ],
      leftToCurator: 'adventurous',
    })
    expect(call.context.thisWeek).toEqual(['shorter'])
    expect(week.mood).toEqual(['shorter'])
    expect(week.shaped).toEqual({ sketches: 2, leftToCurator: 'adventurous' })
    const options = await repo.options.many(week.optionIds)
    expect(options.map((o) => o.shaped)).toEqual([{ title: 'immersive sketch 1' }, { title: 'curious sketch 1', nudge: 'more choral' }, undefined])
  })

  it('a week nobody shaped is written as before, and three others sets the shaping down', async () => {
    const c = fakeCurator({ sketch: sketches, themes: () => themes(['A', 'B', 'C']) })
    const j = journey(c.client)
    at('2026-10-26T09:00:00Z')
    const week = await j.ensureWeek()
    expect(c.calls[0].payload.shaped).toBeUndefined()
    expect(week.shaped).toBeUndefined()
    await j.offerOtherDirections()
    expect(c.calls[1].payload.shaped).toBeUndefined()
  })

  it('a shape that only set the mood sets the week’s mood and marks no direction as yours', async () => {
    const c = fakeCurator({ themes: () => themes(['A', 'B', 'C']) })
    const j = journey(c.client)
    await j.setShape({ mood: ['wider'] })
    at('2026-10-26T09:00:00Z')
    const week = await j.ensureWeek()
    expect(c.calls[0].payload.context.thisWeek).toEqual(['wider'])
    expect(c.calls[0].payload.shaped).toBeUndefined()
    expect(week.mood).toEqual(['wider'])
    expect(week.shaped).toBeUndefined()
  })

  it('a shape for a week already past is never read', async () => {
    const c = fakeCurator({ sketch: sketches, themes: () => themes(['A', 'B', 'C']) })
    const j = journey(c.client)
    await j.sketchNextWeek() // for week 44
    at('2026-11-02T09:00:00Z') // week 45: week 44 was never opened
    await j.ensureWeek()
    expect(c.calls.find((x) => x.op === 'themes')!.payload.shaped).toBeUndefined()
  })
})
