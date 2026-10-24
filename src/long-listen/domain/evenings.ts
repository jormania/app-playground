import type { Programme, ThemeExploration } from './types'

/**
 * An evening of its own: a sitting for tonight made beside a week's programme
 * that its thread doesn't hold. A week has two axes — time (the Journal's
 * calendar: everything heard, in order) and theme (a thread's argument: only
 * what belongs to it). A sitting is always on the first; it is on the second
 * only when it was made beside the theme, or put back there.
 *
 * Membership is the exploration's `extraProgrammeIds`, the one record every
 * thread reader already uses (what it covered, what it holds, the Notion row):
 * an evening left out of it is out of the thread everywhere at once.
 */
export function threadMembers(explorations: Pick<ThemeExploration, 'programmeId' | 'extraProgrammeIds'>[]): Set<string> {
  return new Set(explorations.flatMap((e) => [e.programmeId, ...(e.extraProgrammeIds ?? [])]))
}

export function isOwnEvening(p: Pick<Programme, 'id' | 'sitting' | 'extends'>, members: Set<string>): boolean {
  return Boolean(p.sitting && p.extends && !members.has(p.id))
}

/** What "Follow this evening" asks for: three directions that carry it on — and only then a thread. */
export function eveningSeed(p: Pick<Programme, 'title' | 'dek' | 'sitting'>): string {
  const asked = p.sitting?.request ? ` (asked for as “${p.sitting.request}”)` : ''
  return `Carry on from the evening “${p.title}”${asked}${p.dek ? `: ${p.dek}` : ''} — new directions that start from it, not a repeat of it.`
}
