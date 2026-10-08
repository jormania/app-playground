import { describe, it, expect } from 'vitest'
import { applyTasteUpdate, pendingFeedback, observationsByStance } from './taste'
import type { TasteProfile } from '../domain/types'

const empty: TasteProfile = { observations: [], questions: [], notesToCurator: '', updatedAt: '' }
const obs = (o: Partial<TasteResponseObs> = {}): TasteResponseObs => ({
  facet: 'orchestral-sound', subject: 'colour', statement: 'Drawn to orchestral colour.', stance: 'drawn-to', confidence: 'tentative', evidence: ['fb1'], ...o,
})
type TasteResponseObs = Parameters<typeof applyTasteUpdate>[1]['observations'][number]

describe('the taste profile', () => {
  it('adds an observation in prose, with its evidence, and no score', () => {
    const p = applyTasteUpdate(empty, { observations: [obs()], questions: ['What makes repetition feel alive?'], promptVersion: 'v' }, 't1')
    expect(p.observations).toHaveLength(1)
    expect(p.observations[0]).toMatchObject({ statement: 'Drawn to orchestral colour.', evidence: ['fb1'], firstSeen: 't1' })
    expect(Object.values(p.observations[0]).some((v) => typeof v === 'number')).toBe(false)
    expect(p.questions).toEqual(['What makes repetition feel alive?'])
  })

  it('strengthens what it has seen again instead of duplicating it', () => {
    const once = applyTasteUpdate(empty, { observations: [obs()], questions: [], promptVersion: 'v' }, 't1')
    const twice = applyTasteUpdate(once, { observations: [obs({ evidence: ['fb2'], statement: 'Keeps responding to colour.' })], questions: [], promptVersion: 'v' }, 't2')
    expect(twice.observations).toHaveLength(1)
    expect(twice.observations[0]).toMatchObject({ confidence: 'emerging', evidence: ['fb1', 'fb2'], statement: 'Keeps responding to colour.', lastSeen: 't2', firstSeen: 't1' })
  })

  it('supersedes rather than deletes when a taste moves', () => {
    const first = applyTasteUpdate(empty, { observations: [obs({ facet: 'contemporary-music', subject: 'minimalism', stance: 'wary-of', statement: 'Wary of minimalism.' })], questions: [], promptVersion: 'v' }, 't1')
    const id = first.observations[0].id
    const later = applyTasteUpdate(first, { observations: [obs({ facet: 'contemporary-music', subject: 'minimalism', stance: 'curious-about', statement: 'Now curious about minimalism’s slower kinds.', replaces: id })], questions: [], promptVersion: 'v' }, 't9')
    expect(later.observations).toHaveLength(2)
    expect(later.observations[0].supersededBy).toBe(later.observations[1].id)
    expect(later.observations[1].firstSeen).toBe('t1')
    expect(observationsByStance(later)['curious-about']).toHaveLength(1)
    expect(observationsByStance(later)['wary-of']).toHaveLength(0)
  })

  it('keeps the old questions when no new ones come', () => {
    const p = applyTasteUpdate({ ...empty, questions: ['Q'] }, { observations: [], questions: [], promptVersion: 'v' }, 't')
    expect(p.questions).toEqual(['Q'])
  })

  it('reads only feedback that says something and has not been read', () => {
    const t = { type: 'recording' as const, id: 'r' }
    expect(pendingFeedback([
      { id: 'a', at: '1', target: t, note: 'Lovely.' },
      { id: 'b', at: '1', target: t, reaction: 'liked', interpretedAt: 'x' },
      { id: 'c', at: '1', target: t },
      { id: 'd', at: '1', target: t, more: 'no' },
    ]).map((f) => f.id)).toEqual(['a', 'd'])
  })
})
