// Note race (door C): a note name is shown, she presses any key with that
// name, anywhere on the keyboard, as many as she can before the clock runs
// out. Judged by name, so the keyboard's octave never matters.

export type RaceLevel = 1 | 2 | 3

/** Pitch classes in play: C to G, then every white key, then the black keys too. */
export const RACE_NOTES: Record<RaceLevel, number[]> = {
  1: [0, 2, 4, 5, 7],
  2: [0, 2, 4, 5, 7, 9, 11],
  3: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

export const RACE_MS = 30_000

const pc = (p: number) => ((p % 12) + 12) % 12

export class NoteRace {
  private startedAt: number | null = null
  private current: number
  score = 0
  wrong = 0

  constructor(
    readonly level: RaceLevel,
    private readonly random: () => number = Math.random,
    readonly durationMs = RACE_MS,
  ) {
    this.current = this.pick(null)
  }

  /** The note to find, as a pitch class (0 = C). */
  get prompt(): number {
    return this.current
  }

  start(at: number) {
    this.startedAt = at
  }

  remaining(now: number): number {
    if (this.startedAt === null) return this.durationMs
    return Math.max(0, this.durationMs - (now - this.startedAt))
  }

  finished(now: number): boolean {
    return this.startedAt !== null && this.remaining(now) === 0
  }

  press(pitch: number, at: number): 'right' | 'wrong' | null {
    if (this.startedAt === null || this.finished(at)) return null
    if (pc(pitch) !== this.current) {
      this.wrong++
      return 'wrong'
    }
    this.score++
    this.current = this.pick(this.current)
    return 'right'
  }

  /** A new note each time: never the same one twice in a row. */
  private pick(previous: number | null): number {
    const pool = RACE_NOTES[this.level].filter((n) => n !== previous)
    return pool[Math.min(pool.length - 1, Math.floor(this.random() * pool.length))]
  }
}
