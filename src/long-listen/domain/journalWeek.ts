import type { Programme, ProgrammeOption, WeekKey, WeekRecord } from './types'

/** How a week's music was come by, in the Journal's words. */
export type WeekChoice =
  | { kind: 'chosen' }
  | { kind: 'path'; fromWeek: WeekKey }
  | { kind: 'sitting' }

/**
 * A week in the Journal: the directions it offered, and how its programme was
 * come by. Only the week's own directions count as offered — those it was
 * given, first and since. Its programme may instead come from a path left
 * open in an earlier week (that path is listed under the week that offered
 * it, as taken later) or from a sitting for tonight, whose direction is the
 * evening asked for, not one of the week's to choose between. Counting either
 * among the week's own made "Chosen from 4", or a path taken this week appear
 * as if offered this week.
 *
 * Two kinds are left out of what was offered, because the week already says
 * them: a direction reworked for new settings (its reworking is listed), and
 * one begun then set aside this week (its "set aside" line names it).
 */
export function journalWeek(
  week: WeekRecord | undefined,
  optionById: Map<string, ProgrammeOption>,
  programmes: Pick<Programme, 'id' | 'optionId'>[] = [],
): { offered: ProgrammeOption[]; others: ProgrammeOption[]; choice?: WeekChoice } {
  if (!week) return { offered: [], others: [] }
  const ids = [...(week.earlierOptionIds ?? []), ...week.optionIds]
  const setAside = new Set(programmes.filter((p) => week.setAsideProgrammeIds.includes(p.id)).map((p) => p.optionId))
  const offered = ids
    .map((id) => optionById.get(id))
    .filter((o): o is ProgrammeOption => Boolean(o))
    .filter((o) => o.status !== 'reworked' && !(o.status === 'set-aside' && setAside.has(o.id)))
  const others = offered.filter((o) => o.id !== week.chosenOptionId)
  const taken = week.chosenOptionId ? optionById.get(week.chosenOptionId) : undefined
  if (!taken) return { offered, others }
  if (ids.includes(taken.id)) return { offered, others, choice: { kind: 'chosen' } }
  if (taken.weekKey !== week.weekKey) return { offered, others, choice: { kind: 'path', fromWeek: taken.weekKey } }
  return { offered, others, choice: { kind: 'sitting' } }
}
