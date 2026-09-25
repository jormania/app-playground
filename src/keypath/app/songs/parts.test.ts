import { describe, expect, it } from 'vitest'
import { Judge, DEFAULT_SETTINGS } from '../../engine'
import { songOf } from '../../engine/testing/songs'
import { STARTER_PACK, starterSong } from '../../engine/starterPack'
import { memoryStore } from '../store'
import { nextStep, partPassed, partSteps, phraseStarts, PartsRepo, rangeSong } from './parts'

const starter = (id: string) => starterSong(STARTER_PACK.find((s) => s.id === `starter:${id}`)!)

describe('songs in parts', () => {
  it('two phrases: one, then two, then the whole song', () => {
    expect(partSteps(starter('ode'), 'right').map((s) => s.id)).toEqual(['p1', 'p2', 'whole'])
  })

  it('a phrase that repeats an earlier one isn’t learnt twice', () => {
    // Twinkle is A B B A: A, B, then A and B together, then all of it.
    const steps = partSteps(starter('twinkle'), 'right')
    expect(steps.map((s) => s.id)).toEqual(['p1', 'p2', '1-2', 'whole'])
    expect(steps[2]).toMatchObject({ from: 0, to: 6, first: 1, last: 2 })
    // Au clair de la lune is one line twice.
    expect(partSteps(starter('lune'), 'right').map((s) => s.id)).toEqual(['p1', 'whole'])
  })

  it('after each new phrase from the second on, everything from the start up to it', () => {
    expect(partSteps(starter('jacques'), 'right').map((s) => s.id)).toEqual(['p1', 'p2', '1-2', 'p3', '1-3', 'p4', 'whole'])
  })

  it('learns the hands apart: the left hand’s phrases are its own', () => {
    // Twinkle's left hand also repeats itself (A B B A).
    expect(partSteps(starter('twinkle'), 'left').map((s) => s.id)).toEqual(['p1', 'p2', '1-2', 'whole'])
  })

  it('cuts an added song every four bars, a last single bar joining the one before', () => {
    const notes = (bars: number) => songOf(Array.from({ length: bars * 4 }, (_, i): [number, number] => [60 + (i % 7), i * 500]))
    expect(phraseStarts(notes(9))).toEqual([0, 4])
    expect(phraseStarts(notes(10))).toEqual([0, 4, 8])
    expect(partSteps(notes(4), 'right')).toEqual([])
  })

  it('a part is its bars alone, from 0', () => {
    const part = rangeSong(starter('ode'), 4, 8)!
    expect(Math.min(...part.notes.map((n) => n.startMs))).toBe(0)
    expect(part.notes.every((n) => n.bar >= 4 && n.bar < 8)).toBe(true)
  })

  it('learnt with two wrong keys at most (one in ten for a long part)', () => {
    const part = rangeSong(starter('ode'), 0, 4)!
    const play = (wrong: number) => {
      const j = new Judge(part, { practice: 'right', settings: DEFAULT_SETTINGS })
      let t = 0
      for (let w = 0; w < wrong; w++) j.press(30, t)
      while (j.currentStep) for (const n of j.currentStep.notes) j.press(n.pitch, (t += 400))
      return j.summary()
    }
    expect(partPassed(play(2))).toBe(true)
    expect(partPassed(play(3))).toBe(false)
  })

  it('remembers what each player has learnt, per song and hands, and says what’s next', async () => {
    const repo = new PartsRepo(memoryStore())
    const steps = partSteps(starter('ode'), 'right')
    expect(nextStep(steps, await repo.get('nora', 'starter:ode', 'right'))?.id).toBe('p1')
    await repo.pass('nora', 'starter:ode', 'right', 'p1')
    expect(nextStep(steps, await repo.get('nora', 'starter:ode', 'right'))?.id).toBe('p2')
    expect(await repo.get('nora', 'starter:ode', 'both')).toEqual(new Set())
    expect(await repo.get('gabriel', 'starter:ode', 'right')).toEqual(new Set())
    await repo.pass('nora', 'starter:ode', 'right', 'p2')
    await repo.pass('nora', 'starter:ode', 'right', 'whole')
    // All learnt: the whole song stays the one to play.
    expect(nextStep(steps, await repo.get('nora', 'starter:ode', 'right'))?.id).toBe('whole')
  })
})
