import type { Programme, ProgrammeItem } from '../domain/types'
import { displaySurname, fold, surname } from '../domain/identity'

/**
 * Live in Bucharest: when a programmed work, composer or performer is on at
 * the Ateneu (Filarmonica George Enescu) or Sala Radio, one quiet line on the
 * programme. The Long Listen doesn't scrape: it asks Marquee's one endpoint
 * (api/marquee-scan.js) to read those two venues, the way Marquee itself does,
 * and keeps the answer for a day. No new serverless function.
 */
export const LIVE_VENUES = [
  { id: 'll-filarmonica', name: 'Filarmonica George Enescu', short: 'the Ateneu', url: 'https://www.filarmonicaenescu.ro/ro/evenimente', adapter: 'filarmonica' },
  { id: 'll-salaradio', name: 'Sala Radio', short: 'Sala Radio', url: 'https://salaradio.ro/evenimente/', adapter: 'salaradio' },
]

export interface LiveEvent {
  venue: string
  title: string
  date: string
  time?: string | null
  hall?: string | null
  link?: string | null
  description?: string | null
}

export interface LiveMatch {
  item: ProgrammeItem
  event: LiveEvent
  /** What matched: the very work, one of its performers, or only its composer. */
  how: 'work' | 'performer' | 'composer'
}

const STRENGTH = { work: 0, performer: 1, composer: 2 } as const

/** Words, folded: lower case, no diacritics. */
const words = (s: string | null | undefined) => fold(String(s ?? '')).replace(/[^a-z0-9]+/g, ' ')

/**
 * The numbers that name a work, each with what it numbers: "no 5" for "Symphony
 * No. 5" (or "Simfonia nr. 5"), "op 82", "bwv 1048", "k 550". Read from folded
 * words, and only straight after a designator — a description's "Joi, 9
 * octombrie" is a date, not the Ninth.
 */
function numbersOf(text: string): string[] {
  const kind: Record<string, string> = { no: 'no', nr: 'no', n: 'no', number: 'no', op: 'op', opus: 'op', bwv: 'bwv', k: 'k', kv: 'k', d: 'd', hob: 'hob', rv: 'rv', hwv: 'hwv' }
  return [...words(text).matchAll(/\b(no|nr|n|number|op|opus|bwv|kv?|d|hob|rv|hwv) (?:[ivxlc]+ )?(\d+)\b/g)].map((m) => `${kind[m[1]]} ${Number(m[2])}`)
}

/** Does one programme item meet one concert, and how closely? */
export function meet(item: ProgrammeItem, event: LiveEvent): LiveMatch['how'] | null {
  const text = ` ${words(`${event.title} ${event.description ?? ''}`)} `
  const has = (w: string) => w.length > 2 && text.includes(` ${words(w).trim()} `)
  const composer = surname(item.proposed.composer)
  const composerOn = has(composer)
  if (composerOn) {
    // The hall prints the number or the opus, seldom both: either one, found
    // where the hall numbers something, is the very work.
    const nums = numbersOf(`${item.proposed.work} ${item.proposed.catalogue ?? ''}`)
    const onBill = new Set(numbersOf(`${event.title} ${event.description ?? ''}`))
    const own = nums.filter((n) => n.startsWith('no '))
    const catalogue = nums.filter((n) => !n.startsWith('no '))
    // An opus shared by several pieces (Op. 46's dances) is not enough when the bill numbers a different one.
    const otherNumber = own.length > 0 && [...onBill].some((n) => n.startsWith('no '))
    const byNumber = (own.length > 0 && own.every((n) => onBill.has(n))) || (!otherNumber && catalogue.some((n) => onBill.has(n)))
    const titleWords = words(item.proposed.work).split(' ').filter((w) => w.length > 4 && !/^(symphony|simfonia|concerto|concertul|overture|uvertura|suite|major|minor|sonata)$/.test(w))
    if (byNumber || (titleWords.length && titleWords.every((w) => text.includes(` ${w} `)))) return 'work'
  }
  const performers = [item.proposed.conductor, ...(item.proposed.soloists ?? []).map((x) => x.name)].filter((x): x is string => Boolean(x))
  if (performers.some((p) => has(surname(p)))) return 'performer'
  return composerOn ? 'composer' : null
}

/** The concerts, from today on, that meet the programme — closest matches first, one per item. */
export function liveMatches(programme: Programme, events: LiveEvent[], today: string): LiveMatch[] {
  const out: LiveMatch[] = []
  for (const item of programme.sections.flatMap((s) => s.items)) {
    const found = events
      .filter((e) => e.date >= today)
      .map((event) => ({ item, event, how: meet(item, event) }))
      .filter((m): m is LiveMatch => m.how !== null)
      .sort((a, b) => STRENGTH[a.how] - STRENGTH[b.how] || a.event.date.localeCompare(b.event.date))
    if (found[0]) out.push(found[0])
  }
  return out.sort((a, b) => STRENGTH[a.how] - STRENGTH[b.how] || a.event.date.localeCompare(b.event.date))
}

/** "Sibelius’s Symphony No. 5" / "Blomstedt, who conducts this recording" / "Sibelius" — for the line. */
export function whatIsOn(m: LiveMatch): string {
  const c = displaySurname(m.item.proposed.composer) || m.item.proposed.composer
  if (m.how === 'work') return `${c}’s ${m.item.proposed.work}`
  if (m.how === 'performer') {
    const who = [m.item.proposed.conductor, ...(m.item.proposed.soloists ?? []).map((x) => x.name)].filter(Boolean).find((p) => words(`${m.event.title} ${m.event.description ?? ''}`).includes(words(surname(p!)).trim()))
    return `${who ?? 'a performer from this week'}, from the ${c} recording`
  }
  return `music by ${c}`
}

const DAY = 24 * 60 * 60 * 1000

/**
 * The two venues' programmes, from Marquee's endpoint — kept for a day in the
 * store (`live:scan`) so opening the programme doesn't re-read two websites.
 * Fails quietly: the line simply doesn't appear (offline, the dev server).
 */
export async function liveEvents(
  marks: { get(id: string): Promise<{ at: string; value?: unknown } | undefined>; put(m: { id: string; at: string; value?: unknown }): Promise<void> },
  fetchImpl: typeof fetch = (...a) => fetch(...a),
  now = new Date(),
): Promise<LiveEvent[]> {
  const cached = await marks.get('live:scan')
  if (cached && now.getTime() - Date.parse(cached.at) < DAY) return (cached.value as LiveEvent[]) ?? []
  // Offline or refused, a day-old reading still beats none: the concerts in it haven't moved.
  const stale = (e: unknown) => { if (cached) return (cached.value as LiveEvent[]) ?? []; throw e }
  let res: Response
  try {
    res = await fetchImpl('/api/marquee-scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ venues: LIVE_VENUES.map(({ id, name, url, adapter }) => ({ id, name, url, adapter })) }),
    })
  } catch (e) {
    return stale(e)
  }
  if (!res.ok) return stale(new Error(`marquee-scan ${res.status}`))
  const data = await res.json() as { events?: LiveEvent[] }
  const events = (data.events ?? []).map(({ venue, title, date, time, hall, link, description }) => ({ venue, title, date, time, hall, link, description }))
  await marks.put({ id: 'live:scan', at: now.toISOString(), value: events })
  return events
}

/** The venue's everyday name for the line: "the Ateneu", "Sala Radio". */
export function venueShort(venue: string): string {
  return LIVE_VENUES.find((v) => v.name === venue)?.short ?? venue
}
