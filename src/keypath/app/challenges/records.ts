import { K, type KeyValueStore } from '../store'
import type { ChordLevel } from './chordCatch'
import type { EarLevel } from './earTrain'
import type { ReadLevel } from './readPlay'
import type { RaceLevel } from './noteRace'
import type { EchoLevel } from './rhythm'

/** Each game a score is kept for. The note race read off a staff ('staff') keeps its own, apart from the named race. */
export type ChallengeGame = 'race' | 'staff' | 'echo' | 'chord' | 'ear' | 'read'

/** Best results per player: notes found in a race, patterns echoed in a round of five, chords caught. */
export interface ChallengeRecords {
  race: Partial<Record<RaceLevel, number>>
  staff: Partial<Record<RaceLevel, number>>
  echo: Partial<Record<EchoLevel, number>>
  chord: Partial<Record<ChordLevel, number>>
  /** Notes found by ear, first time, in a round of five. */
  ear: Partial<Record<EarLevel, number>>
  /** Pieces read and played without a wrong key, in a round of five. */
  read: Partial<Record<ReadLevel, number>>
}

const empty = (): ChallengeRecords => ({ race: {}, staff: {}, echo: {}, chord: {}, ear: {}, read: {} })

export class RecordRepo {
  constructor(private readonly store: KeyValueStore) {}

  /** Records saved before a game existed simply lack its table: filled in empty. */
  async get(profileId: string): Promise<ChallengeRecords> {
    return { ...empty(), ...(await this.store.get<Partial<ChallengeRecords>>(K.challenges(profileId))) }
  }

  /** Keep the better of the old best and this score. True if this is a new best. */
  async offer(profileId: string, game: ChallengeGame, level: number, score: number): Promise<boolean> {
    const r = await this.get(profileId)
    const table = r[game] as Record<number, number>
    const before = table[level]
    if (before !== undefined && before >= score) return false
    table[level] = score
    await this.store.set(K.challenges(profileId), r)
    return score > 0
  }
}
