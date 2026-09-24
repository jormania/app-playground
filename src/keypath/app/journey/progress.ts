import { K, type KeyValueStore } from '../store'
import { JOURNEY, type StepId } from './steps'

export interface StepDone {
  at: string
  /** 'check': done in order. 'testOut': its check passed while it was still locked. */
  how: 'check' | 'testOut'
}

export type JourneyProgress = Partial<Record<StepId, StepDone>>

export type StepState = 'done' | 'open' | 'locked'

/** The first step not done is open; everything after it is locked (but can be tested out). */
export function stateOf(progress: JourneyProgress, id: StepId): StepState {
  if (progress[id]) return 'done'
  const firstOpen = JOURNEY.find((s) => !progress[s.id])
  return firstOpen?.id === id ? 'open' : 'locked'
}

export class JourneyRepo {
  constructor(private readonly store: KeyValueStore) {}

  async get(profileId: string): Promise<JourneyProgress> {
    return (await this.store.get<JourneyProgress>(K.journey(profileId))) ?? {}
  }

  /**
   * A passed check completes that step only: each step proves its own skill
   * (reading a staff says nothing about chords). If it was still locked, it
   * was tested out; the steps before it stay open to do or test out in turn.
   */
  async pass(profileId: string, id: StepId, now = new Date()): Promise<JourneyProgress> {
    const progress = await this.get(profileId)
    if (progress[id]) return progress
    const next: JourneyProgress = { ...progress, [id]: { at: now.toISOString(), how: stateOf(progress, id) === 'locked' ? 'testOut' : 'check' } }
    await this.store.set(K.journey(profileId), next)
    return next
  }
}
