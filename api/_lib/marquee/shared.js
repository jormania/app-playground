// Helpers every Marquee adapter needs. Pure, and tested in
// api/_tests/marquee-adapters.test.js against the saved fixtures.
//
// No DOM here: a serverless function has no parser and this repo carries no
// server-side one (jsdom is dev-only). Adapters match markup with regexes, the
// same way api/clickdeck-studio-search.js reads Steam's HTML. That is fine for
// four hand-picked sites with a health gate behind them (MARQUEE.md §6); it would
// not be fine at fifty.

/** Ticket states, as the app's model names them. */
export const TICKET = { OPEN: 'open', SOLD_OUT: 'sold-out', NONE: 'none' }

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

/** Decode the entity forms these sites actually emit — named basics plus the
 *  numeric escapes eventbook uses for every Romanian diacritic (`&#537;`). */
export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+|#\d+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole)
}

/** Visible text of an HTML fragment: tags out, entities decoded, runs of
 *  whitespace collapsed. */
export function textOf(html) {
  return decodeEntities(String(html ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

/** First capture group of `re` against `html`, as visible text, or null. */
export function pick(html, re) {
  const m = re.exec(html)
  return m ? (textOf(m[1]) || null) : null
}

/** Lowercase, diacritics stripped, non-alphanumerics collapsed to single dashes.
 *  Used for both venue and title slugs, so `speranțe` and `sperante` are one key
 *  and a stray accent fix on the venue's side never fakes a brand-new event. */
export function slug(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // ș/ț sometimes arrive as the cedilla codepoints, which NFD does not decompose.
    .replace(/[șş]/gi, 's')
    .replace(/[țţ]/gi, 't')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The stable identity everything diffs on:
 *  `venue-slug:YYYY-MM-DD[THH:MM]:title-slug`.
 *
 *  **The time is part of the identity when the venue prints one.** A theatre runs
 *  the same production twice in a day — Excelsior lists Tomcat at 17:00 sold out
 *  and at 20:00 with tickets on sale, on the same date — so a key of venue+date+
 *  title collides, dedupe drops the second showing, and the survivor reports the
 *  wrong ticket state. Two showings are two events. */
export function eventKey(venue, date, title, time = null) {
  return `${slug(venue)}:${date ?? 'undated'}${time ? `T${time}` : ''}:${slug(title)}`
}

// Romanian and English month abbreviations, both of which appear across these
// sites (Excelsior renders `Aug`/`Sep`/`Oct`, which happen to coincide, but
// `Ian`, `Mai`, `Iun`, `Iul`, `Noi` do not).
const MONTHS = {
  ian: 1, ianuarie: 1, jan: 1, january: 1,
  feb: 2, februarie: 2, february: 2,
  mar: 3, martie: 3, march: 3,
  apr: 4, aprilie: 4, april: 4,
  mai: 5, may: 5,
  iun: 6, iunie: 6, jun: 6, june: 6,
  iul: 7, iulie: 7, jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, septembrie: 9, september: 9,
  oct: 10, octombrie: 10, october: 10,
  noi: 11, nov: 11, noiembrie: 11, november: 11,
  dec: 12, decembrie: 12, december: 12,
}

export function monthNumber(name) {
  const key = slug(name).replace(/-/g, '')
  return MONTHS[key] ?? null
}

function iso(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Turn a year-less day+month ("27 Aug") into an ISO date, relative to `today`.
 *
 * A programme page lists what is coming, so a month that has already passed means
 * NEXT year — "10 Ian" read in December is January. The rule is deliberately
 * asymmetric: it rolls forward on a month that is behind, and tolerates a few days
 * of backward slack within the current month so a listing that still shows
 * yesterday's show doesn't jump a whole year.
 *
 * This is the piece of Marquee most likely to be quietly wrong for two weeks a
 * year, which is why it is a named function with its own tests rather than three
 * lines inside an adapter.
 */
export function inferYear(day, month, today = new Date()) {
  const d = Number(day)
  const m = typeof month === 'number' ? month : monthNumber(month)
  if (!Number.isInteger(d) || d < 1 || d > 31 || !m) return null

  const year = today.getFullYear()
  const candidate = iso(year, m, d)
  const todayKey = iso(year, today.getMonth() + 1, today.getDate())

  if (candidate >= todayKey) return candidate
  // Behind today: within the same month it is almost certainly a show that has
  // just passed and not yet been cleared; further back, the programme has wrapped
  // into next year.
  if (m === today.getMonth() + 1) return candidate
  return iso(year + 1, m, d)
}

/** `HH:MM` from a loose time string, or null. Guards the hour/minute ranges so a
 *  price or a duration can never be read as a start time. */
export function parseTime(text) {
  const m = /\b(\d{1,2})[:.](\d{2})\b/.exec(String(text ?? ''))
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Absolute URL from a possibly-relative href. Returns null rather than throwing
 *  so one malformed link can't fail a whole scan. */
export function absoluteUrl(href, base) {
  if (!href) return null
  try {
    return new URL(decodeEntities(href), base).toString()
  } catch {
    return null
  }
}

/** Shape and sanity-check one parsed row. Adapters build the loose object; this
 *  is what decides whether it is an event at all. A row without a title or a date
 *  is dropped — those two are the identity, and a half-row would diff as a new
 *  event every single scan. */
export function makeEvent({ venue, title, date, time = null, hall = null, link = null, ticketState = TICKET.NONE, ticketsUrl = null, image = null, price = null }) {
  const cleanTitle = textOf(title)
  if (!cleanTitle || !date) return null
  // A hall that just repeats the venue is noise: Expirat's JSON-LD names its
  // location "Expirat Halele Carol", which rendered as "Expirat Halele Carol ·
  // Expirat Halele Carol" on every card. Containment, not equality — "Sala Mare"
  // at "Ateneul Român" is a real hall and must survive.
  const cleanHall = hall ? textOf(hall) : null
  const keptHall = cleanHall && !slug(venue ?? '').includes(slug(cleanHall)) ? cleanHall : null
  return {
    key: eventKey(venue, date, cleanTitle, time),
    venue,
    title: cleanTitle,
    date,
    time: time ?? null,
    hall: keptHall,
    link: link ?? null,
    ticketState,
    ticketsUrl: ticketsUrl ?? null,
    image: image ?? null,
    price: typeof price === 'number' && Number.isFinite(price) ? price : null,
  }
}

/** Drop repeats of the same key, keeping the first (page order = the site's own
 *  order). eventbook can echo a showing across its pagination when a page turns
 *  between requests. */
export function dedupe(events) {
  const seen = new Set()
  const out = []
  for (const e of events) {
    if (!e || seen.has(e.key)) continue
    seen.add(e.key)
    out.push(e)
  }
  return out
}
