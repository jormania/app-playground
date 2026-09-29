import type { Finger, Hand, Practice, SongNote } from './song'

// Where the hands go before a song starts (KEYPATH_TUTOR.md §9, "Batch: where
// the hands go"): the key each hand's thumb sits on, or its little finger for
// a song with no finger numbers, worked out from the first notes. Starting
// with a hand in the wrong place is the commonest beginner stumble, and an
// added song carries no fingering to say where. Free of React.

export interface HandPlace {
  hand: Hand
  /** Which finger sits on `pitch`: the thumb (1), or the little finger (5) when the song has no fingering. */
  finger: Finger
  /** A white key. */
  pitch: number
}

const WHITE = [0, 2, 4, 5, 7, 9, 11]
const WHITE_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]

/** Which white key a pitch is on, counted up from C-1; a black key counts as the white key below it. */
const whiteIndex = (pitch: number) => Math.floor(pitch / 12) * 7 + WHITE_INDEX[((pitch % 12) + 12) % 12]
const whitePitch = (index: number) => Math.floor(index / 7) * 12 + WHITE[((index % 7) + 7) % 7]
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/** How many of a hand's first notes say where it sits. */
const FIRST_NOTES = 8

function placeOf(notes: readonly SongNote[], hand: Hand): HandPlace | null {
  const mine = notes.filter((n) => n.hand === hand).sort((a, b) => a.startMs - b.startMs).slice(0, FIRST_NOTES)
  if (mine.length === 0) return null
  const fingered = mine.filter((n) => n.finger)
  if (fingered.length > 0) {
    // The right hand's finger f is f-1 white keys above its thumb; the left's is f-1 below it.
    const sign = hand === 'right' ? -1 : 1
    const thumb = median(fingered.map((n) => whiteIndex(n.pitch) + sign * ((n.finger as number) - 1)))
    return { hand, finger: 1, pitch: whitePitch(thumb) }
  }
  const lowest = mine.reduce((a, b) => (b.pitch < a.pitch ? b : a))
  return { hand, finger: hand === 'right' ? 1 : 5, pitch: whitePitch(whiteIndex(lowest.pitch)) }
}

/** Where each hand sits at the start of `notes`, for the hands being practised: right first. */
export function handPlaces(notes: readonly SongNote[], practice: Practice): HandPlace[] {
  const hands: Hand[] = practice === 'both' ? ['right', 'left'] : [practice]
  return hands.flatMap((h) => placeOf(notes, h) ?? [])
}
