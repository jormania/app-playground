import type { JudgeSummary } from './judge'
import type { Hand } from './song'

/**
 * Two players on one keyboard: a run of the whole song, read as each player's
 * own. The notes carry their hand, so results split cleanly; a wrong key
 * belongs to whoever's notes it lies nearest to (the keyboard has one
 * player's hand on each side of the middle of the song).
 */
export function summaryForHand(s: JudgeSummary, hand: Hand): JudgeSummary {
  const mine = s.results.filter((r) => r.note.hand === hand)
  const pitches = (h: Hand) => s.results.filter((r) => r.note.hand === h).map((r) => r.note.pitch)
  const right = pitches('right')
  const left = pitches('left')
  // Where one hand's keys end and the other's begin: halfway between the right hand's lowest and the left hand's highest.
  const split = right.length && left.length ? (Math.min(...right) + Math.max(...left)) / 2 : null
  const belongs = (pitch: number): Hand => (split === null ? hand : pitch >= split ? 'right' : 'left')
  return { ...s, results: mine, wrong: s.wrong.filter((w) => belongs(w.pitch) === hand), total: mine.length }
}
