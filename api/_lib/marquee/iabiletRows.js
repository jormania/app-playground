// iabilet.ro listing rows — the reader that replaced its JSON-LD (§9.94).
//
// On 2026-10-18 iabilet.ro stopped emitting schema.org markup on its LISTING
// pages. Not one `application/ld+json` block survived on any of the three this
// repo watches — Quantic and Cinema Europa on the main site, Expirat Halele
// Carol on the whitelabel — and all three reported "no events could be read"
// in the same check. One upstream change, three venues, nothing broken on our
// side and nothing broken on theirs: the programme is still there, served
// plainly, with the structured copy removed.
//
// **Only the listings lost it.** An event's own page still carries its JSON-LD,
// and a bundle page still carries its `data-is-tariff` rows — verified against
// both while writing this. So everything downstream of the listing (iabilet.js's
// tariff reader, `startTimeOf`, the detail cache) is untouched, and this module
// has exactly one job: hand those readers the same blocks the JSON-LD used to.
//
// That shape is the design. `listingBlocks()` returns objects with `name`,
// `url`, `startDate`, `endDate`, `image`, `description` and `price` — the
// subset of schema.org's Event that the adapters actually read — so `isBundle`,
// `follow` and the screening loop all keep working against a vocabulary they
// already know. The alternative, teaching three adapters a second vocabulary,
// would have spread the change over every file that touches this host.
//
// **Two templates, one row.** The main site renders a venue page as a table of
// `data-event-list="item"` rows; the whitelabel renders a home page as a stack
// of `box event-is-future` cards. They differ in where the title and date sit
// and in one way that matters to the caller:
//
//   venue page   `<span class="date-day">18</span><span class="date-month">oct</span>`
//                — a date and NO hour, which is why Quantic still needs its hop
//   whitelabel   `duminică, 18 octombrie, ora 19:00 acces de la 20:00`
//                — date AND hour, in the same sentence `startTimeOf` reads
//
// so a whitelabel block comes back with its time already in `startDate` and a
// venue-page block comes back bare, exactly as the two JSON-LD templates did.
//
// **No year anywhere.** The JSON-LD carried full ISO timestamps; a row carries
// "18 oct". Every date here goes through `inferYear`, which is why `now` is a
// required argument rather than a convenience — a listing read in late December
// must roll January forward, and a reader that defaulted to `new Date()` would
// be right in testing and wrong for two weeks a year.

import { decodeEntities, inferYear, monthNumber, parseTime, textOf, absoluteUrl } from './shared.js'

/** Both templates wrap every row in this, and nothing else on either page uses
 *  it — the whitelabel's cards sit inside `data-event-list="item"` columns too.
 *  Splitting on it rather than matching balanced `<div>`s, because these rows
 *  nest four levels deep and a regex cannot count. */
const ROW_SPLIT = /(?=<div\s+data-event-list="item")/

/** A row that is a row, rather than the list's own container or filter chrome. */
const IS_ROW = /class="(?:row event-list-item|col-sm-12 slot)/

const DATE_START = /<div class="date-start">([\s\S]{0,300}?)<\/div>/
const DATE_END = /<div class="date-end">([\s\S]{0,300}?)<\/div>/
const DAY = /<span class="date-day">\s*(\d{1,2})\s*<\/span>/
const MONTH = /<span class="date-month">\s*([^<\s]+)\s*<\/span>/

const VENUE_TITLE = /<div class="title">[\s\S]{0,400}?<a[^>]*>([\s\S]{0,300}?)<\/a>/
const WL_TITLE = /<h1>([\s\S]{0,300}?)<\/h1>/
// The whitelabel's date sentence: the SECOND paragraph of `.date-location`, the
// first being "Expirat Halele Carol, București".
const WL_DATE_LINE = /<div class="date-location">[\s\S]{0,200}?<p>[\s\S]{0,200}?<\/p>\s*<p>([\s\S]{0,200}?)<\/p>/
const WL_DAY_MONTH = /(\d{1,2})\s+([A-Za-zăâîșşțţ]+)/

const LINK = /href="(\/bilete-[^"#?]+)/
const IMAGE = /<img\s+src="([^"]+)"/
// The row's own blurb: a bare `<div>` after `.location` on a venue page. Bounded
// and taken once, so the markup's own nested divs can't drag in the next row.
const VENUE_BLURB = /<\/div>\s*<div>([\s\S]{0,600}?)<\/div>/
const WL_BLURB = /<div class="short-desc">([\s\S]{0,600}?)<\/div>/
const PRICE = /<div class="price">([\s\S]{0,120}?)<\/div>/

/** `ora` is the show and `acces de la` is the doors, and the doors are EARLIER
 *  — the §9.87 rule, applied here to the whitelabel's one-line date sentence
 *  rather than to an event page's `.date` block. Taking the last clock on the
 *  line would print a 20:00 start for a 21:00 gig on every row that publishes
 *  both, which at Expirat is most of them. */
function timeFromLine(line) {
  const show = /\bora\s+(\d{1,2}:\d{2})/i.exec(line)
  if (show) return parseTime(show[1])
  const doors = /acces\s+de\s+la\s+(\d{1,2}:\d{2})/i.exec(line)
  return doors ? parseTime(doors[1]) : null
}

function dayMonth(fragment) {
  if (!fragment) return null
  const day = DAY.exec(fragment)?.[1]
  const month = MONTH.exec(fragment)?.[1]
  if (!day || !month) return null
  const m = monthNumber(month)
  return m ? { day, month: m } : null
}

/** iabilet hangs campaign tracking off every link it prints
 *  (`?ica_source=VenuePage&…`). Stripped, because `link` is an event's identity
 *  here — it is what the detail hop fetches and what the cache is keyed on, and
 *  a URL that carries which page you arrived from would key the same event two
 *  ways the day the template changes its campaign name. */
function rowLink(row, base) {
  const href = LINK.exec(row)?.[1]
  return href ? absoluteUrl(href, base) : null
}

/** "de la 30 lei" → 30. A floor rather than a price, which is the same reading
 *  the tariff loop takes (cheapest open tariff). Null when the row shows none —
 *  a sold-out row prints no price at all. */
function rowPrice(row) {
  const text = textOf(PRICE.exec(row)?.[1] ?? '')
  const m = /(\d+(?:[.,]\d+)?)/.exec(text)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * The listing's events, in the shape iabilet.ro used to publish them.
 *
 * `startDate` is `YYYY-MM-DD` on a venue page and `YYYY-MM-DDTHH:MM` on the
 * whitelabel, mirroring what each template actually knows. `endDate` is present
 * only on a multi-day row, which is what `isBundle` reads to tell a themed
 * weekend from a single screening — the same structural test as before, now
 * reading `date-end` instead of schema.org's `endDate`.
 *
 * A row that yields no date is dropped rather than guessed at. The health gate
 * turns an empty return into a visible "its markup has probably changed",
 * which is how this change announced itself in the first place.
 */
export function listingBlocks(html, { now = new Date(), base = 'https://www.iabilet.ro/' } = {}) {
  const out = []
  for (const row of String(html ?? '').split(ROW_SPLIT)) {
    if (!IS_ROW.test(row.slice(0, 400))) continue

    const whitelabel = /class="box event-is-future/.test(row)
    const title = textOf((whitelabel ? WL_TITLE : VENUE_TITLE).exec(row)?.[1] ?? '')
    if (!title) continue

    let startDate = null
    let endDate = null
    if (whitelabel) {
      const line = textOf(WL_DATE_LINE.exec(row)?.[1] ?? '')
      const dm = WL_DAY_MONTH.exec(line)
      const month = dm ? monthNumber(dm[2]) : null
      const date = dm && month ? inferYear(dm[1], month, now) : null
      if (!date) continue
      const time = timeFromLine(line)
      startDate = time ? `${date}T${time}` : date
    } else {
      const start = dayMonth(DATE_START.exec(row)?.[1])
      if (!start) continue
      startDate = inferYear(start.day, start.month, now)
      if (!startDate) continue
      const end = dayMonth(DATE_END.exec(row)?.[1])
      // Anchored on the row's own start rather than on today, so a weekend that
      // runs across New Year ends in January rather than eleven months back.
      if (end) endDate = inferYear(end.day, end.month, new Date(`${startDate}T00:00:00Z`))
    }

    out.push({
      name: title,
      url: rowLink(row, base),
      startDate,
      ...(endDate && endDate > startDate.slice(0, 10) ? { endDate } : {}),
      image: decodeEntities(IMAGE.exec(row)?.[1] ?? '') || null,
      description: textOf((whitelabel ? WL_BLURB : VENUE_BLURB).exec(row)?.[1] ?? '') || null,
      price: rowPrice(row),
      // The row says so in a class, which is the only sold-out signal a listing
      // carries now; a bundle's per-showing state still comes off its tariffs.
      soldOut: /event-without-stock|no-tickets/.test(row.slice(0, 400)),
    })
  }
  return out
}
