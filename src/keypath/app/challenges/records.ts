import { K, type KeyValueStore } from '../store'
import type { RaceLevel } from './noteRace'
import type { EchoLevel } from './rhythm'

/** Best results per player: notes found in a race, patterns echoed in a round of five. */
export interface ChallengeRecords {
  race: Partial<Record<RaceLevel, number>>
  echo: Partial<Record<EchoLevel, number>>
}

export class RecordRepo {
  constructor(private readonly store: KeyValueStore) {}

  async get(profileId: string): Promise<ChallengeRecords> {
    return (await this.store.get<ChallengeRecords>(K.challenges(profileId))) ?? { race: {}, echo: {} }
  }

  /** Keep the better of the old best and this score. True if this is a new best. */
  async offer(profileId: string, game: 'race' | 'echo', level: number, score: number): Promise<boolean> {
    const r = await this.get(profileId)
    const table = r[game] as Record<number, number>
    const before = table[level]
    if (before !== undefined && before >= score) return false
    table[level] = score
    await this.store.set(K.challenges(profileId), r)
    return score > 0
  }
}
