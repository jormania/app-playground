import { describe, it, expect } from 'vitest'
import { applyTasteUpdate } from '../curation/taste'
import type { TasteObservation, TasteProfile } from '../domain/types'
import type { TasteResponse } from '../curation/api'

const obs = (id: string, stance: TasteObservation['stance'], extra: Partial<TasteObservation> = {}): TasteObservation => ({
  id, facet: 'composer', subject: 'Sibelius', statement: `${stance} Sibelius`, stance, confidence: 'emerging', evidence: ['fb0'], firstSeen: '2026-09-01T00:00:00Z', lastSeen: '2026-09-01T00:00:00Z', ...extra,
})
const profile = (observations: TasteObservation[]) => ({ observations, questions: [], notesToCurator: '', updatedAt: '2026-09-01T00:00:00Z' }) as unknown as TasteProfile
const update = (o: Partial<TasteResponse['observations'][number]>): TasteResponse => ({
  observations: [{ facet: 'composer', subject: 'Sibelius', statement: 'Now drawn to Sibelius, after the concert.', stance: 'drawn-to', confidence: 'tentative', evidence: ['fb1'], ...o }],
  questions: [], promptVersion: 'taste@test', model: 'm',
} as TasteResponse)

describe('audit: taste observations', () => {
  it('replacing one observation with a stance another active one already holds does not leave two active copies', () => {
    // Active: drawn to Sibelius's symphonies (X) and wary of Sibelius (Y, older). A concert changes Y into drawn-to.
    const p = profile([obs('X', 'drawn-to'), obs('Y', 'wary-of')])
    const next = applyTasteUpdate(p, update({ replaces: 'Y' }), '2026-10-10T00:00:00Z')
    const active = next.observations.filter((o) => !o.supersededBy && o.subject === 'Sibelius' && o.stance === 'drawn-to')
    expect(active).toHaveLength(1)
  })
})
