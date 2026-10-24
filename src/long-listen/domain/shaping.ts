import type { ISODate, ListeningState, OptionMood, WeekKey, WeekMood } from './types'

/**
 * Shaping next week: a light hand on the three directions before they are
 * written. Once most of this week's programme is heard, the listener can say
 * where to go and how the week should feel, and see three sketches — one line
 * for each slot — which they may nudge, swap, or leave to the curator. When the
 * week turns, its three directions are written from what stands.
 *
 * Nothing here is required: a week nobody shaped is written exactly as before.
 * Stored per week in the marks (`shape:<week key>`): a shape for a week that has
 * already passed is never read.
 */
export type ShapeWhere = 'stay' | 'new' | 'either'

export const SHAPE_WHERE: { value: ShapeWhere; label: string }[] = [
  { value: 'stay', label: 'stay with this thread' },
  { value: 'new', label: 'somewhere new' },
  { value: 'either', label: 'either' },
]

/** One slot's sketch: a title and a line, and what it came from. */
export interface Sketch {
  mood: OptionMood
  title: string
  line: string
  /** Where it came from, in a few words: "from your wish", "the thread's open question". */
  from: string
  /** The listener's words, when they nudged it; the sketch is redrafted with them. */
  nudge?: string
}

export interface WeekShape {
  /** The week being shaped: the one after the week it was made in. */
  weekKey: WeekKey
  where: ShapeWhere
  /** How the week should feel: set as that week's mood when it begins ("This week, differently"). */
  mood: WeekMood[]
  sketches: Sketch[]
  /** The slot left to the curator: no sketch, a surprise on the day. Null when every slot is shaped. */
  leftToCurator: OptionMood | null
  /** Every title sketched and swapped away, so a swap never brings one back. */
  passed: string[]
  updatedAt: string
}

export const SHAPE_SLOTS: OptionMood[] = ['immersive', 'curious', 'adventurous']

export const shapeKey = (weekKey: WeekKey): string => `shape:${weekKey}`

export function emptyShape(weekKey: WeekKey, at: string): WeekShape {
  return { weekKey, where: 'either', mood: [], sketches: [], leftToCurator: 'adventurous', passed: [], updatedAt: at }
}

/** The slots that get a sketch: all three but the one left to the curator. */
export function shapedSlots(shape: Pick<WeekShape, 'leftToCurator'>): OptionMood[] {
  return SHAPE_SLOTS.filter((m) => m !== shape.leftToCurator)
}

/**
 * When "Shape next week" is offered: once two thirds of this week's programme
 * is heard (a skip counts as done with), or on the week's last day with at
 * least one work heard — so a week only half listened to still gets it.
 */
export function shapeOpen(states: ListeningState[], today: ISODate, endsOn: ISODate): boolean {
  if (!states.length) return false
  const done = states.filter((s) => s === 'heard' || s === 'skipped').length
  if (done * 3 >= states.length * 2 && states.includes('heard')) return true
  return today === endsOn && states.includes('heard')
}

/** True when the listener has said anything at all: a shape with nothing in it changes nothing. */
export function shapeSaysSomething(shape: WeekShape | undefined): shape is WeekShape {
  return Boolean(shape && (shape.sketches.length || shape.mood.length || shape.where !== 'either'))
}

/**
 * What the curator is told on the day, beside the usual context: where to go,
 * the sketches to write from (with any nudge), and the slot left to it.
 */
export interface ShapedBrief {
  where: ShapeWhere
  sketches: { mood: OptionMood; title: string; line: string; nudge: string }[]
  leftToCurator: OptionMood | ''
}

export function shapedBrief(shape: WeekShape): ShapedBrief {
  const slots = new Set(shapedSlots(shape))
  return {
    where: shape.where,
    sketches: shape.sketches.filter((s) => slots.has(s.mood)).map((s) => ({ mood: s.mood, title: s.title, line: s.line, nudge: s.nudge ?? '' })),
    leftToCurator: shape.leftToCurator ?? '',
  }
}
