import type { ConcertDraft } from '../curation/journey'
import type { PrepareResponse } from '../curation/api'
import type { LiveEvent } from '../live/live'
import { fold } from './identity'

/**
 * Before and after a concert (release four). A concert from Live in Bucharest
 * marked as one the listener is going to is kept as a mark (`going:<key>`).
 * In the week before it, a short preparation is offered; once its evening has
 * passed, the concert entry is offered pre-filled from the announced programme
 * — no screenshot needed — until it is kept (or the mark taken back).
 */
export interface Going {
  key: string
  event: LiveEvent
  markedAt: string
  /** The concert kept from it, once kept: the mark has done its work. */
  concertId?: string
}

/** How many days ahead the preparation is offered. */
export const PREPARE_DAYS = 7
/** How long after the evening the pre-filled entry is still offered. */
const AFTER_DAYS = 21

/** One concert, one key: its date and hour, venue and hall, and title, folded — the same listing read again keeps its key. */
export function goingKey(e: Pick<LiveEvent, 'date' | 'venue' | 'title'> & Partial<Pick<LiveEvent, 'hall' | 'time'>>): string {
  const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // The hall and the hour too: a matinee and an evening (or Sala Mare and Sala Mică) on one day are two concerts.
  const where = [slug(e.venue).slice(0, 32), e.hall ? slug(e.hall).slice(0, 16) : ''].filter(Boolean).join('-')
  return `${e.date}${e.time ? `T${e.time.replace(/\D/g, '').slice(0, 4)}` : ''}~${where}~${slug(e.title).slice(0, 48)}`
}

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 86_400_000)
/** Days from `today` to `date`: 0 on the day, negative after. */
export const daysUntil = (date: string, today: string) => dayNumber(date) - dayNumber(today)

/**
 * Where a marked concert stands: `later` (more than a week away), `ahead` (in
 * the week before it, the day itself included), `after` (passed, not yet kept),
 * `done` (kept, or long past).
 */
export function goingStage(g: Going, today: string): 'later' | 'ahead' | 'after' | 'done' {
  if (g.concertId) return 'done'
  const d = daysUntil(g.event.date, today)
  if (d > PREPARE_DAYS) return 'later'
  if (d >= 0) return 'ahead'
  return d >= -AFTER_DAYS ? 'after' : 'done'
}

/** "tonight", "tomorrow", "on Thursday", "on 23 October". */
export function whenWords(date: string, today: string): string {
  const d = daysUntil(date, today)
  if (d === 0) return 'tonight'
  if (d === 1) return 'tomorrow'
  const at = new Date(`${date}T12:00:00Z`)
  const opts: Intl.DateTimeFormatOptions = d > 1 && d < 7 ? { weekday: 'long', timeZone: 'UTC' } : { day: 'numeric', month: 'long', timeZone: 'UTC' }
  return `on ${new Intl.DateTimeFormat('en-GB', opts).format(at)}`
}

/**
 * The concert entry, pre-filled: the hall's listing for where and when, the
 * preparation's reading of it for who played what. Everything stays editable
 * in the form; without a preparation, the works are left for the listener.
 */
export function draftFrom(g: Going, prep?: Omit<PrepareResponse, 'promptVersion'>): ConcertDraft {
  const e = g.event
  return {
    venue: e.venue,
    ...(e.hall ? { hall: e.hall } : {}),
    date: e.date,
    ...(e.time && /^\d{1,2}:\d{2}$/.test(e.time) ? { time: e.time } : {}),
    ...(prep?.orchestra ? { orchestra: prep.orchestra } : {}),
    ...(prep?.conductor ? { conductor: prep.conductor } : {}),
    soloists: prep?.soloists ?? [],
    works: prep?.works.length
      ? prep.works.map((w) => ({ composer: w.composer, title: w.title, ...(w.catalogue ? { catalogue: w.catalogue } : {}), ...(w.soloists ? { soloists: w.soloists } : {}) }))
      : [{ composer: '', title: '' }],
    source: 'typed',
  }
}
