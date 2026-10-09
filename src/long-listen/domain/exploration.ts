import type { Level, ListenerPreferences } from './types'

/**
 * The words for the listener's exploration settings — one vocabulary for
 * Settings, the Notion notebook and the curator, so a level means the same
 * thing everywhere.
 */
export const TIME: Record<ListenerPreferences['timePerWeek'], { label: string; words: string; works: [number, number] }> = {
  short: { label: '1 h', words: 'about an hour of music a week', works: [3, 4] },
  standard: { label: '2–3 h', words: 'two or three hours a week', works: [5, 7] },
  generous: { label: '4–5 h', words: 'four or five hours a week', works: [8, 10] },
  abundant: { label: '6 h +', words: 'six hours or more a week', works: [11, 14] },
}

export const BREADTH: Record<Level, { label: string; words: string }> = {
  1: { label: 'One focus', words: 'one focus — a single composer, one family of works or one tight idea, explored closely' },
  2: { label: 'Close', words: 'a close circle — a composer and their immediate world, one period' },
  3: { label: 'Several', words: 'several composers around the theme, within one or two periods' },
  4: { label: 'Across eras', words: 'the theme followed across periods, with the connections between eras drawn out' },
  5: { label: 'Centuries', words: 'the theme traced across centuries, early music to today, with unexpected neighbours' },
}

export const FAMILIARITY: Record<Level, { label: string; words: string }> = {
  1: { label: 'Cornerstones', words: 'the great, well-known works — to hear again and know more deeply' },
  2: { label: 'Well loved', words: 'mostly well-known music, with a few lesser-known pieces' },
  3: { label: 'A mix', words: 'a balance of the well known and the unfamiliar' },
  4: { label: 'Off the path', words: 'mostly lesser-known music — neglected masterpieces and side roads' },
  5: { label: 'Rare & new', words: 'rarities, the avant-garde and the experimental — music almost nobody programmes' },
}

export const LEVELS: Level[] = [1, 2, 3, 4, 5]
