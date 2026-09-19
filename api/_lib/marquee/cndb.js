// Centrul Național al Dansului București (CNDB) — https://cndb.ro/calendar/
//
// Rung 3 (selector). **Not** read from where its tickets are sold. CNDB sells
// through bilet.ro, and that was the obvious place to point this — but
// bilet.ro sits behind Queue-it, a virtual waiting room: a server-side fetch is
// bounced into an endless `?queueittoken=…` redirect (fifty hops and no page).
// That door only opens for a real browser session, so it is not a source.
//
// CNDB's own site is, and reading a venue's own programme over its ticketing
// front-end is the precedent metropolis.js already set for exactly this reason.
// One page carries a rolling ~2-month window (32 rows across Aug–Oct as
// inspected 2026-09-19); `/calendar/2025-2026/` is the *archive* of a finished
// season and must not be used — every date on it is in the past.
//
// The markup is WordPress blocks and unusually clean. One row per showing:
//
//   <div class="wp-block-columns program-event">
//     <div …><p data-time="02.09.2025">02.09.2025</p></div>   -- full year, no inference
//     <div class="wp-block-column mobile-only">
//       <p>marți</p><p>19:00</p>                              -- weekday, then time
//     </div>
//     … the same weekday and time again, in two desktop-only columns …
//     <div …>
//       <h2>Title</h2>
//       <p>Subtitle</p>
//       <p class="external"><a href="…/new_events/<slug>/?calendar=true">strapline</a></p>
//       <p class="full-link"><a href="…?calendar=true&inst=4"> </a></p>
//     </div>
//     <div …><figure><img src="…" class="wp-image"></figure></div>
//   </div>
//
// **The date needs no `inferYear`.** `data-time` prints the full year, which
// makes this the one reader here immune to the December/January rollover that
// shared.js's `inferYear` exists to survive. Read the attribute, not the text.
//
// **No ticket state is published at all** — one row in 103 mentioned a ticket
// anywhere. So every showing reads `ticketState: none`, which §9.7 established
// is the honest answer to a source that says nothing: never `open`, and never
// a sold-out house inferred from silence.
//
// Also absent: any hall. CNDB has more than one space but the calendar names
// none of them, so `hall` stays null rather than being guessed from a title.

import { TICKET, makeEvent, pick, parseTime, absoluteUrl } from './shared.js'

const BASE = 'https://cndb.ro/'
// Rows are bounded by the next row's opening div — the same lookahead shape
// tnb.js uses for its day blocks, so a row with a missing field can never
// reach forward and borrow the next row's.
const ROW = /<div class="wp-block-columns program-event">([\s\S]*?)(?=<div class="wp-block-columns program-event">|$)/g
const DATE = /data-time="(\d{2})\.(\d{2})\.(\d{4})"/
const TIME = /\b(\d{1,2}:\d{2})\b/
const TITLE = /<h2[^>]*>([\s\S]*?)<\/h2>/
// The subtitle is the first paragraph after the title and before the strapline
// link — "Modulul 3, coordonat de Mădălina Dan". Bounded to that gap so the
// strapline and the invisible full-link anchor can never be read as prose.
const SUBTITLE = /<\/h2>\s*<p>([\s\S]*?)<\/p>/
const LINK = /<a href="(https:\/\/cndb\.ro\/new_events\/[^"?]+)/
const IMAGE = /<img[^>]+src="([^"]+)"/

/**
 * Courses and workshops, which the user asked to keep out of the programme.
 *
 * **There is no structured signal for this, and that is worth being plain
 * about.** CNDB publishes no event taxonomy: the only `categorie/` links on the
 * site are blog sections, the detail pages' body classes carry nothing, and the
 * `class="external"` strapline turns out to be free text — festival and project
 * names, absent entirely on 39 of 103 archive rows. So this reads the title,
 * which is a keyword rule and carries a keyword rule's risks.
 *
 * It is deliberately **narrow, and errs toward including**. Against the live
 * calendar it catches fourteen rows — every "Dansezi? Cursuri de dans", the
 * six-night "Geometry of chance workshop", and two named workshops — with no
 * false positive. What it does NOT catch it lets through: "Școala performativă
 * pentru copii" could be a class or could be that school's own performance, and
 * an extra workshop on the list costs a glance where a missing premiere costs
 * the evening. Wrong in the recoverable direction, the same asymmetry §9.62
 * turns on.
 *
 * The residual hazard is §9.82's in miniature: a piece genuinely titled
 * "Atelier" would be dropped. Nothing in two seasons of titles is one.
 */
const COURSE = /\b(curs|cursuri|cursul|atelier|ateliere|atelierul|workshop|workshops)\b/i

export function isCourse(title) {
  return COURSE.test(String(title ?? ''))
}

export default {
  id: 'cndb',
  label: 'Centrul Național al Dansului București',
  rung: 'selector',
  // A rolling two-month window ran to 32 rows, 18 of them performances, on the
  // day this was built. Four is "the centre is between seasons", not "the
  // parser broke" — the same floor excelsior and metropolis carry.
  minItems: 4,

  requests: (venue) => [{ url: venue.url }],

  parse(pages, { venue } = {}) {
    const html = pages[0]?.body ?? ''
    const events = []
    let m
    ROW.lastIndex = 0
    while ((m = ROW.exec(html)) !== null) {
      const row = m[1]
      const title = pick(row, TITLE)
      if (!title || isCourse(title)) continue

      const d = DATE.exec(row)
      // `data-time` is the only date on the row and it is already unambiguous;
      // a row without one is a row this reader cannot place, so it is dropped
      // rather than dated by guesswork.
      if (!d) continue
      const [, day, month, year] = d

      const href = LINK.exec(row)?.[1] ?? null
      const image = IMAGE.exec(row)?.[1] ?? null

      events.push(makeEvent({
        venue: venue.name,
        title,
        date: `${year}-${month}-${day}`,
        time: parseTime(pick(row, TIME)),
        // Not published anywhere on this page — see the header.
        hall: null,
        // The production's own page, with `?calendar=true&inst=N` stripped:
        // the query says which showing you arrived from, which is noise in a
        // link meant to survive being saved to Wanderlist.
        link: href ? absoluteUrl(href, BASE) : null,
        image: image ? absoluteUrl(image, BASE) : null,
        description: pick(row, SUBTITLE),
        ticketState: TICKET.NONE,
      }))
    }
    return events.filter(Boolean)
  },
}
