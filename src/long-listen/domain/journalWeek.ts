import type { ProgrammeOption, WeekKey, WeekRecord } from './types'

/** How a week's music was come by, in the Journal's words. */
export type WeekChoice =
  | { kind: 'chosen'; from: number }
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
 */
export function journalWeek(week: WeekRecord | undefined, optionById: Map<string, ProgrammeOption>): { offered: ProgrammeOption[]; others: ProgrammeOption[]; choice?: WeekChoice } {
  if (!week) return { offered: [], others: [] }
  const offered = [...(week.earlierOptionIds ?? []), ...week.optionIds]
    .map((id) => optionById.get(id))
    .filter((o): o is ProgrammeOption => Boolean(o))
  const others = offered.filter((o) => o.id !== week.chosenOptionId)
  const taken = week.chosenOptionId ? optionById.get(week.chosenOptionId) : undefined
  if (!taken) return { offered, others }
  if (offered.some((o) => o.id === taken.id)) return { offered, others, choice: { kind: 'chosen', from: offered.length } }
  if (taken.weekKey !== week.weekKey) return { offered, others, choice: { kind: 'path', fromWeek: taken.weekKey } }
  return { offered, others, choice: { kind: 'sitting' } }
}
