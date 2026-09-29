import { describe, expect, it } from 'vitest'
import { songOf } from '../../engine/testing/songs'
import { memoryStore } from '../store'
import { SetupRepo, suggestedSpeed } from './setup'

describe('SetupRepo', () => {
  it('keeps the hands and the speed per song and per player', async () => {
    const repo = new SetupRepo(memoryStore())
    expect(await repo.get('nora', 'starter:ode')).toBeNull()
    await repo.set('nora', 'starter:ode', { practice: 'left', speed: '0.75' })
    await repo.set('nora', 'starter:lune', { practice: 'both', speed: '0.5' })
    expect(await repo.get('nora', 'starter:ode')).toEqual({ practice: 'left', speed: '0.75' })
    expect(await repo.get('nora', 'starter:lune')).toEqual({ practice: 'both', speed: '0.5' })
    expect(await repo.get('gabriel', 'starter:ode')).toBeNull()
  })

  it('mends a record it doesn’t understand rather than trusting it', async () => {
    const store = memoryStore({ 'keypath:v1:setup:nora': { a: { practice: 'up', speed: '3' } } })
    expect(await new SetupRepo(store).get('nora', 'a')).toEqual({ practice: 'right', speed: '1' })
  })
})

describe('suggestedSpeed', () => {
  // Sixteenths at 90 bpm, in one hand: quick enough to be rated Harder however thin.
  const quick = () => songOf(Array.from({ length: 40 }, (_, i): [number, number] => [60 + (i % 12), i * 150]), 'Quick')

  it('is full speed, but 75% for the easy version of a song that is still Harder', () => {
    expect(suggestedSpeed(songOf([[60, 0], [62, 500], [64, 1000]], 'Slow'))).toBe('1')
    expect(suggestedSpeed(quick())).toBe('1')
    expect(suggestedSpeed({ ...quick(), easy: true })).toBe('0.75')
    expect(suggestedSpeed({ ...songOf([[60, 0], [62, 500], [64, 1000]], 'Slow'), easy: true })).toBe('1')
  })
})
