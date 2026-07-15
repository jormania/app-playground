import { CURRICULUM, PASSION_WISDOM, WeekCurriculum, Discipline } from '../data/curriculum';

/** The curriculum for a cycle-week (1–4). Values outside 1–4 are wrapped into
 *  range so any absolute week number maps to a real entry. */
export function getWeekCurriculum(week: number): WeekCurriculum {
  const idx = ((Math.floor(week) - 1) % 4 + 4) % 4;
  return CURRICULUM[idx];
}

export function getDisciplineForWeek(week: number): Discipline {
  return getWeekCurriculum(week).discipline;
}

/** Ancient maxim matched to a flaring passion (by its id in data/passions.ts),
 *  or null if none is mapped. Used by the Pause drill's contextual wisdom. */
export function getPassionWisdom(passionId: string): { maxim: string; author: string } | null {
  return PASSION_WISDOM[passionId] ?? null;
}
