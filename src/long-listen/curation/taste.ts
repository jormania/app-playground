import type { Feedback, TasteObservation, TasteProfile } from '../domain/types'
import { newId } from '../domain/identity'
import type { TasteResponse } from './api'

/**
 * Fold the taste interpreter's answer into the profile.
 *
 * Nothing is overwritten in place. An observation that refines or contradicts
 * an earlier one supersedes it — the earlier one stays, marked, so the notebook
 * can show how a taste moved ("first wary of minimalism; by spring, curious").
 * The same subject and stance seen again strengthens what's there rather than
 * adding a duplicate.
 */
const STRONGER = { tentative: 'emerging', emerging: 'settled', settled: 'settled' } as const

export function applyTasteUpdate(profile: TasteProfile, update: TasteResponse, now: string): TasteProfile {
  const observations = profile.observations.map((o) => ({ ...o }))
  const active = () => observations.filter((o) => !o.supersededBy)

  for (const u of update.observations) {
    const replaced = u.replaces ? observations.find((o) => o.id === u.replaces && !o.supersededBy) : undefined
    // Looked for even when the update replaces something: if wary-of turns into
    // drawn-to and drawn-to is already held, the replaced one is superseded by
    // that, which grows stronger — two active copies of one taste would read
    // as two opinions.
    const same = active().find((o) => o !== replaced && o.facet === u.facet && o.subject.toLowerCase() === u.subject.toLowerCase() && o.stance === u.stance)

    if (same) {
      if (replaced) replaced.supersededBy = same.id
      same.statement = u.statement
      same.confidence = rank(u.confidence) > rank(same.confidence) ? u.confidence : STRONGER[same.confidence]
      same.evidence = [...new Set([...same.evidence, ...u.evidence])]
      same.lastSeen = now
      continue
    }

    const fresh: TasteObservation = {
      id: newId('obs'),
      facet: u.facet,
      subject: u.subject,
      statement: u.statement,
      stance: u.stance,
      confidence: u.confidence,
      evidence: u.evidence,
      firstSeen: replaced?.firstSeen ?? now,
      lastSeen: now,
    }
    if (replaced) replaced.supersededBy = fresh.id
    observations.push(fresh)
  }

  return {
    ...profile,
    observations,
    questions: update.questions.length ? update.questions : profile.questions,
    updatedAt: now,
  }
}

function rank(c: TasteObservation['confidence']): number {
  return { tentative: 0, emerging: 1, settled: 2 }[c]
}

/** Feedback worth reading: anything with words, a reaction, or a wish for more or less, not yet read. */
export function pendingFeedback(all: Feedback[]): Feedback[] {
  return all.filter((f) => !f.interpretedAt && (f.note || f.reaction || f.more))
}

/** Active observations, grouped for the Notebook. */
export function observationsByStance(profile: TasteProfile): Record<TasteObservation['stance'], TasteObservation[]> {
  const out: Record<TasteObservation['stance'], TasteObservation[]> = { 'drawn-to': [], 'curious-about': [], mixed: [], 'wary-of': [] }
  for (const o of profile.observations) if (!o.supersededBy) out[o.stance].push(o)
  for (const k of Object.keys(out) as TasteObservation['stance'][]) {
    out[k].sort((a, b) => rank(b.confidence) - rank(a.confidence) || b.lastSeen.localeCompare(a.lastSeen))
  }
  return out
}
