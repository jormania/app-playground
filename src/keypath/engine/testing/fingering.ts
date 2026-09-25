import type { Hand, Song } from '../song'

/**
 * What looks wrong in a song's written fingering: the sanity checks that catch
 * a digit string out of step with its notes. Within a bar, a repeated note
 * keeps its finger, and between neighbouring keys (a step apart) the finger
 * moves the way the hand does: up for the right hand, down for the left. The
 * thumb is exempt, since it passes under and the fingers cross over it.
 */
export function fingeringProblems(song: Song): string[] {
  const problems: string[] = []
  for (const hand of ['right', 'left'] as Hand[]) {
    const notes = song.notes.filter((n) => n.hand === hand)
    const fingered = notes.filter((n) => n.finger)
    if (fingered.length === 0) continue
    if (fingered.length !== notes.length) problems.push(`${hand}: ${fingered.length} fingers for ${notes.length} notes`)
    for (let i = 1; i < notes.length; i++) {
      const a = notes[i - 1]
      const b = notes[i]
      if (!a.finger || !b.finger || a.bar !== b.bar) continue
      const at = `${hand} note ${i} (bar ${b.bar + 1})`
      const step = b.pitch - a.pitch
      if (step === 0 && a.finger !== b.finger) problems.push(`${at}: a repeated note changes finger`)
      if (step !== 0 && Math.abs(step) <= 2 && a.finger !== 1 && b.finger !== 1) {
        const up = (b.finger - a.finger) * (hand === 'right' ? 1 : -1)
        if (Math.sign(up) !== Math.sign(step)) problems.push(`${at}: the finger goes against the keys`)
      }
    }
  }
  return problems
}
