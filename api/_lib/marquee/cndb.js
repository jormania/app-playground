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
//
// ## The registration form, and why this venue is followed at all (§9.96)
//
// CNDB mostly does not sell tickets. It gives a show away free and takes
// bookings through a **Google Form**, and the form is very often added to an
// event's page days AFTER the event itself goes up — there is no announcement
// and no pattern to it. A free show with a form fills quickly, so the moment
// the link appears is the thing worth knowing, and it is invisible from the
// calendar: eleven detail pages read on 2026-11-10 carried four forms between
// them and the calendar page carried none.
//
// So each upcoming event's own page is read for one fact: is there a
// registration form on it yet. Where there is, the showing comes out
// `ticketState: open` with the form as its `ticketsUrl`, which is all
// `diff.js` needs — a showing going `none` → `open` is already a
// `tickets-opened` change, so it reaches the Changed filter, the notification
// and the evening mail with no new vocabulary anywhere.
//
// **The heading above the link is not the signal.** It has been seen as
// "Participare" ("Intrarea este liberă, pe baza de înscriere in formularul
// disponibil AICI") and as "Înscriere" ("Participarea este gratuită…"), and a
// page with a form has also carried no heading at all. The LINK is the signal:
// a `forms.gle` or `docs.google.com/forms` URL anywhere in the page.
//
// **What `open` means here, said plainly.** It means a registration link has
// been published — not that places remain. A Google Form that has stopped
// accepting responses still answers at its URL, and nothing on CNDB's page
// says otherwise, so neither does this. That is the trade the feature is for:
// knowing within a scan that booking opened, rather than knowing how full it
// is.

import { TICKET, decodeEntities, makeEvent, pick, parseTime, absoluteUrl } from './shared.js'

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

/** A Google registration form, wherever on the page it sits.
 *
 *  Matched on the LINK rather than on the sentence around it, because the
 *  sentence changes — "Participare", "Înscriere", or no heading at all — while
 *  the host does not. Both shapes CNDB publishes are covered: the shortened
 *  `forms.gle/<id>` and the full `docs.google.com/forms/d/<id>/viewform`.
 *
 *  Entities are decoded, because the long form arrives with its query
 *  `&amp;`-escaped out of the HTML; the URL is otherwise left exactly as the
 *  venue published it, quirks and all. It is their link, and a tidied one that
 *  no longer matches theirs would be a worse answer, not a better one. */
const FORM = /https?:\/\/(?:forms\.gle\/[^"'<>\s]+|docs\.google\.com\/forms\/[^"'<>\s]+)/i

export function registrationForm(body) {
  const m = FORM.exec(String(body ?? ''))
  return m ? decodeEntities(m[0]).replace(/[.,;]+$/, '') : null
}

/** How many upcoming events may be followed for a form in one scan.
 *
 *  Seventeen were upcoming on the day this was written and each page costs
 *  about a second, so this is also the venue's share of the scheduled check's
 *  time budget (§9.89). Twenty is a ceiling against a season that balloons,
 *  not a target: the per-scan DETAIL budget in scan.js is twelve and bites
 *  first, handing the oldest-known pages out across consecutive scans. */
const MAX_FOLLOWED = 20

export default {
  id: 'cndb',
  label: 'Centrul Național al Dansului București',
  rung: 'selector',
  // A rolling two-month window ran to 32 rows, 18 of them performances, on the
  // day this was built. Four is "the centre is between seasons", not "the
  // parser broke" — the same floor excelsior and metropolis carry.
  minItems: 4,

  requests: (venue) => [{ url: venue.url }],

  /** One hop per UPCOMING event, for the registration form (§9.96).
   *
   *  Past rows are skipped: the calendar carries a whole season and a form
   *  added to last month's show is not news. Courses are skipped for the same
   *  reason they never reach the programme (`isCourse`). Followed in calendar
   *  order, which is date order, so the soonest show — the one whose booking
   *  closes first — is the first to get the budget. */
  follow(pages, { venue, now = new Date() } = {}) {
    const today = now.toISOString().slice(0, 10)
    const seen = new Set()
    for (const event of this.parse(pages.slice(0, 1), { venue: venue ?? { name: '' } })) {
      if (!event.link || event.date < today) continue
      seen.add(event.link)
    }
    return [...seen].slice(0, MAX_FOLLOWED).map((url) => ({ url }))
  },

  /** **Only a form found is ever remembered.** A page with none returns null,
   *  which the scan reads as "store nothing, ask again next time" — and asking
   *  again is the entire feature, so a cached "no form yet" would quietly
   *  switch it off. That is §9.80's rule applied where it bites: the absence
   *  is the volatile fact here, not the presence.
   *
   *  A day, not the default week, for the one that IS stored. The link itself
   *  is stable, but a form can be taken down or replaced, and a day bounds how
   *  long a dead link can sit on a card while costing one request per event
   *  per day at a venue that publishes a dozen at a time. */
  extractDetail(page) {
    const form = registrationForm(page.body ?? '')
    return form ? { form } : null
  },

  detailTtlMs: 24 * 60 * 60 * 1000,

  parse(pages, { venue, details } = {}) {
    const html = pages[0]?.body ?? ''
    const events = []

    // Forms by the page they were found on. Remembered records first, pages
    // read in THIS scan second, so a page actually fetched always beats a
    // cached account of it. Gathered BEFORE the events are built: `makeEvent`
    // is given the finished ticket state rather than having it patched on, the
    // same discipline §9.87 imposes for a start time.
    const forms = new Map()
    for (const [url, record] of Object.entries(details ?? {})) {
      if (record?.form) forms.set(url, record.form)
    }
    for (const page of pages.slice(1)) {
      if (!page.url) continue
      const form = registrationForm(page.body ?? '')
      if (form) forms.set(page.url, form)
    }

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

      const link = href ? absoluteUrl(href, BASE) : null
      const form = link ? forms.get(link) ?? null : null

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
        link,
        image: image ? absoluteUrl(image, BASE) : null,
        description: pick(row, SUBTITLE),
        // A published registration form is the only "you can get in" signal
        // this venue ever gives. With none, `none` stays the honest answer
        // (§9.7): never `open`, and never a full house inferred from silence.
        ticketState: form ? TICKET.OPEN : TICKET.NONE,
        ticketsUrl: form,
      }))
    }
    return events.filter(Boolean)
  },
}
