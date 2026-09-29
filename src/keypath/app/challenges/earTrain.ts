// Ear check (door C): two notes are played, the first shown, the second not;
// she finds the second on the keyboard by ear. Any octave counts, since only
// the note's name is being listened for, and the keyboard may be set an octave
// away from the screen. Five to a round; a point for each found first time,
// three tries at most, and after the first wrong key she is told which way.

export type EarLevel = 1 | 2 | 3

export const EAR_ROUND = 5
export const MAX_TRIES = 3

export interface EarQuestion {
  /** The note that is played and shown. */
  root: number
  /** The note to find. */
  target: number
}

/** The screen's white keys from middle C: the level 1 and 2 notes. */
const WHITE = [60, 62, 64, 65, 67, 69, 71, 72]
/** Where the notes may sit, so both are on the screen's keys. */
const LOW = 55
const HIGH = 72

const pc = (p: number) => ((p % 12) + 12) % 12

/**
 * What a level asks: 1, a neighbouring white key (one or two along); 2, up to
 * four along; 3, any key within an octave, black ones too.
 */
export function targetsFor(level: EarLevel, root: number): number[] {
  if (level === 3) {
    const out: number[] = []
    for (let p = Math.max(LOW, root - 12); p <= Math.min(HIGH, root + 12); p++) if (p !== root) out.push(p)
    return out
  }
  const reach = level === 1 ? 2 : 4
  const at = WHITE.indexOf(root)
  return WHITE.filter((_, i) => i !== at && Math.abs(i - at) <= reach)
}

export function questionFor(level: EarLevel, random: () => number = Math.random, previous: EarQuestion | null = null): EarQuestion {
  // Roots are C to G, so a level 1 or 2 target always has room either side.
  const roots = WHITE.slice(0, 5)
  for (let tries = 0; tries < 20; tries++) {
    const root = roots[Math.floor(random() * roots.length)]
    const targets = targetsFor(level, root)
    const target = targets[Math.floor(random() * targets.length)]
    if (!previous || root !== previous.root || target !== previous.target) return { root, target }
  }
  return { root: 60, target: 64 }
}

export type EarOutcome = 'right' | 'wrong' | 'missed'

export class EarTrain {
  private question: EarQuestion
  private tries = 0
  /** Set once the question is answered, or given up: waiting for `next()`. */
  private resolved = false
  /** Number of the question in hand (from 1) and how many were found first time. */
  number = 1
  score = 0
  /** Wrong keys, over the round. */
  wrong = 0
  /** Which way the target lies from the last wrong key, once there has been one. */
  hint: 'higher' | 'lower' | null = null

  constructor(
    readonly level: EarLevel,
    private readonly random: () => number = Math.random,
  ) {
    this.question = questionFor(level, random)
  }

  get current(): EarQuestion {
    return this.question
  }

  get isResolved() {
    return this.resolved
  }

  get finished() {
    return this.number > EAR_ROUND
  }

  /** A key struck. Ignored while the question waits for `next()`. */
  press(pitch: number): EarOutcome | null {
    if (this.resolved || this.finished) return null
    if (pc(pitch) === pc(this.question.target)) {
      if (this.tries === 0) this.score++
      this.resolved = true
      return 'right'
    }
    this.tries++
    this.wrong++
    // Which way round the octave is shorter.
    this.hint = (pc(this.question.target) - pc(pitch) + 12) % 12 <= 6 ? 'higher' : 'lower'
    if (this.tries >= MAX_TRIES) {
      this.resolved = true
      return 'missed'
    }
    return 'wrong'
  }

  /** On to the next question: after a right key or a give-up. */
  next(): void {
    if (!this.resolved) return
    this.number++
    this.tries = 0
    this.resolved = false
    this.hint = null
    if (!this.finished) this.question = questionFor(this.level, this.random, this.question)
  }
}
