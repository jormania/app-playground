import { MODEL_HAIKU } from '../../../shared/anthropic'
import { askClaude } from '../ai'
import type { LogRecord } from '../log'
import type { Language } from '../profiles'
import { K, type KeyValueStore } from '../store'
import { localDate, summarise } from './summary'

// The weekly note (KEYPATH_TUTOR.md §9, "The weekly note"): a few sentences
// for the parent in Progress, written by Claude from a player's last seven
// days in the log, against the seven before. Asked for with a button, never
// on its own, and kept, so opening Progress again costs nothing. The name
// isn't sent: Claude writes {name}, and the phone puts it in.

export interface WeekFacts {
  /** The seven days, first and last (YYYY-MM-DD). */
  from: string
  to: string
  daysPractised: number
  minutes: number
  sessions: number
  /** Minutes in each door. */
  doors: Record<'songs' | 'journey' | 'challenges' | 'studio', number>
  songsFinished: { title: string; times: number; bestStars: number | null }[]
  songsLeftUnfinished: { title: string; times: number }[]
  partsLearnt: number
  barsPractised: number
  barsMadeClean: number
  journeyChecksPassed: number
  journeyChecksFailed: number
  gamesPlayed: number
  studioTakesKept: number
  todayCardsDone: number
  stickersEarned: string[]
  songsAdded: number
  /** The seven days before, for a comparison. */
  weekBefore: { daysPractised: number; minutes: number; songsFinished: number }
}

const dayMinus = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d - days, 12).toISOString())
}

export interface WeekInput {
  records: readonly LogRecord[]
  /** Today, on the phone's calendar. */
  today: string
  title: (songId: string) => string
  /** Sticker ids earned, with the day each was earned, and how to name one. */
  stickers: Map<string, string>
  stickerName: (id: string) => string
}

/** The week in numbers and titles, never her name. */
export function weekFacts({ records, today, title, stickers, stickerName }: WeekInput): WeekFacts {
  const from = dayMinus(today, 6)
  const before = dayMinus(today, 13)
  const inWeek = records.filter((r) => localDate(r.at) >= from && localDate(r.at) <= today)
  const inWeekBefore = records.filter((r) => localDate(r.at) >= before && localDate(r.at) < from)
  const s = summarise(inWeek)
  const b = summarise(inWeekBefore)
  const round = (n: number) => Math.round(n)
  return {
    from,
    to: today,
    daysPractised: s.days.length,
    minutes: round(s.minutes),
    sessions: s.sessions,
    doors: { songs: round(s.doors.songs.minutes), journey: round(s.doors.journey.minutes), challenges: round(s.doors.challenges.minutes), studio: round(s.doors.studio.minutes) },
    songsFinished: s.songs.bySong.filter((x) => x.finished > 0).map((x) => ({ title: title(x.songId), times: x.finished, bestStars: x.bestStars })),
    songsLeftUnfinished: s.songs.bySong.filter((x) => x.finished === 0 && x.abandoned > 0).map((x) => ({ title: title(x.songId), times: x.abandoned })),
    partsLearnt: s.songs.parts.learnt,
    barsPractised: s.songs.bars.practised,
    barsMadeClean: s.songs.bars.clean,
    journeyChecksPassed: s.journey.checksPassed,
    journeyChecksFailed: s.journey.checksFailed,
    gamesPlayed: s.challenges.race + s.challenges.staff + s.challenges.echo + s.challenges.chord,
    studioTakesKept: s.studio.kept,
    todayCardsDone: inWeek.filter((r) => r.type === 'today_done').length,
    stickersEarned: [...stickers.entries()].filter(([, day]) => day >= from && day <= today).map(([id]) => stickerName(id)),
    songsAdded: s.songs.added,
    weekBefore: { daysPractised: b.days.length, minutes: round(b.minutes), songsFinished: b.songs.finished },
  }
}

const SYSTEM = `You write a short weekly note for a parent about a family member's piano practice in a practice app, from the practice log. The player is usually a child of about ten; sometimes it is the parent themself.

Refer to the player only as {name}, written exactly like that, with the braces; the app puts the name in. Never guess whether the player is a boy or a girl: choose wordings that need no gender.

Use only the facts you are given; don't invent songs, numbers or feelings. Write four to six sentences, at most 110 words, in one paragraph:
- how much {name} practised and what, gently compared with the week before;
- what went well (songs finished, stars, parts learnt, bars made clean, stickers);
- where {name} may be stuck (songs left unfinished, Journey checks not passed), without blame;
- one concrete thing the parent could do this week: sit in on a song, praise something specific, suggest a short daily time.
If nothing was practised, say so kindly and suggest a small, easy start.

No lists, headings, emojis or quotation marks.`

const LANGUAGE_LINE: Record<Language, string> = {
  en: 'Write in English.',
  ro: 'Write in Romanian, with correct diacritics (ă, â, î, ș, ț). Use verb forms that are the same for a boy or a girl (a exersat, a terminat), not adjectives or participles that agree with the player.',
}

/**
 * The note, if it can be trusted: short, with no placeholder but {name}. It is
 * kept with {name} in it; the name goes in when it's shown (`withName`).
 */
export function checkWeekly(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean || clean.length > 1200) return null
  if (/[{}]/.test(clean.replaceAll('{name}', ''))) return null
  return clean
}

export const withName = (text: string, name: string) => text.replaceAll('{name}', name)

export async function askWeekly(key: string, facts: WeekFacts, language: Language, options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}): Promise<string | null> {
  const text = await askClaude(key, { model: MODEL_HAIKU, maxTokens: 500, system: `${SYSTEM}\n\n${LANGUAGE_LINE[language]}`, user: `This week's practice log, as JSON:\n${JSON.stringify(facts)}` }, options)
  return text === null ? null : checkWeekly(text)
}

/** A note as kept: when it was written and in which language, so a new day or language can ask for a fresh one. */
export interface KeptWeekly {
  date: string
  language: Language
  /** With {name} in place of the name, so a rename doesn't leave the old one in it. */
  text: string
}

export class WeeklyRepo {
  constructor(private readonly store: KeyValueStore) {}
  async get(profileId: string): Promise<KeptWeekly | null> {
    return (await this.store.get<KeptWeekly>(K.weekly(profileId))) ?? null
  }
  async keep(profileId: string, note: KeptWeekly): Promise<void> {
    await this.store.set(K.weekly(profileId), note)
  }
}
