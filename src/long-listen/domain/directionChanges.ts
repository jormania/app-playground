import { BREADTH, FAMILIARITY, TIME } from './exploration'
import { WEEK_MOODS, type DirectionsMadeWith, type ListenerPreferences, type WeekMood } from './types'

/** One setting that moved since the week's three directions were made, in Settings' own words. */
export interface DirectionChange {
  setting: string
  was: string
  now: string
}

const ERA: Record<ListenerPreferences['recordingEra'], string> = {
  any: 'Any', 'historic-welcome': 'Historic', 'modern-sound': 'Modern', 'period-practice': 'Period',
}
const DEPTH: Record<ListenerPreferences['depth'], string> = { concise: 'Concise', standard: 'Standard', deeper: 'Deeper' }
const LANGUAGE: Record<ListenerPreferences['language'], string> = { en: 'English', ro: 'Română' }
const onOff = (b: boolean) => (b ? 'On' : 'Off')

/** Every setting a week's directions are made with, named as Settings names it. */
const SETTINGS: { setting: string; words: (p: Omit<ListenerPreferences, 'nextRequest'>) => string }[] = [
  { setting: 'Music each week', words: (p) => TIME[p.timePerWeek].label },
  { setting: 'How widely a week ranges', words: (p) => BREADTH[p.breadth].label },
  { setting: 'How well known the music is', words: (p) => FAMILIARITY[p.familiarity].label },
  { setting: 'Same work, two perspectives', words: (p) => onOff(p.pairs) },
  { setting: 'Recordings', words: (p) => ERA[p.recordingEra] },
  { setting: 'Works with voices', words: (p) => onOff(p.includeVoices) },
  { setting: 'Concertos', words: (p) => onOff(p.includeConcertos) },
  { setting: 'How much it writes', words: (p) => DEPTH[p.depth] },
  { setting: 'Language', words: (p) => LANGUAGE[p.language] },
]

const moodWords = (mood?: WeekMood[]) =>
  mood?.length ? WEEK_MOODS.filter((m) => mood.includes(m.value)).map((m) => m.label).join(', ') : 'no changes'

/**
 * What moved since the week's three directions were made: a setting changed in
 * Settings, or the week tuned differently. Any change means "three others" is a
 * request for the same three, reworked to fit — not for somewhere new.
 *
 * [] when nothing moved, and when the week doesn't know what its three were
 * made with (made before that was kept): without it, a change can't be told
 * from none, and "three others" keeps its plain meaning.
 */
export function directionChanges(madeWith: DirectionsMadeWith | undefined, preferences: ListenerPreferences, mood: WeekMood[] | undefined): DirectionChange[] {
  if (!madeWith) return []
  const changes: DirectionChange[] = []
  for (const { setting, words } of SETTINGS) {
    const was = words(madeWith.preferences)
    const now = words(preferences)
    if (was !== now) changes.push({ setting, was, now })
  }
  const was = moodWords(madeWith.mood)
  const now = moodWords(mood)
  if (was !== now) changes.push({ setting: 'Tune this week', was, now })
  return changes
}
