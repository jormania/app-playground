import { Button } from '../ds'
import { formatWhen, stalenessDays, relativeDays, spanOf, parseDay, dayMonth, formatTime } from './dates.js'
import { signalsFor, signalLabel, freshness } from './signals.js'
import { mapUrlFor, appUrlFor } from './wanderlist.js'
import { fold } from './dedupe.js'
import { BackIcon, ExternalIcon, HideIcon, CalendarIcon, CheckIcon } from './icons.jsx'
import { formatWhen as formatWhenDate } from './dates.js'
import { useT } from './i18n.js'

/** Which store a mention came through, said in words rather than in a code. */
const kindLabel = (kind, t) => t(`kind.${kind}`)

/**
 * The detail view answers, in this order: what is this · when · where · why might
 * I care · how much · how do I go · where did this come from · can I save it.
 * That order is the spec (RADAR_B.md §7) and the reason the layout looks like a
 * record rather than a web page.
 *
 * A row is only drawn when it says something. "Preț necunoscut", "ora
 * neconfirmată" on a three-day festival, an `altundeva` area code, "Încă nedecis"
 * next to "fără dată planificată" — each of those filled a line to report the
 * absence of a fact, and together they were most of what the screen said. Absence
 * is legible on its own: a cost row that isn't there IS "we don't know".
 */
/** Which of the Wanderlist chips are worth drawing for this event.
 *
 *  A chip earns its place by saying something the screen has not already said.
 *  The planned date is normally the event's own date — that's what planning it
 *  means — so repeating it under a WHEN row that already reads `azi, 21:00` adds
 *  a second identical timestamp. Likewise a one-night event expires the night it
 *  happens. Both are shown only when they DIFFER from the event's own dates,
 *  which is exactly when they carry news: a run you plan to catch on a specific
 *  later day, or a deadline that falls before the thing itself. */
export function wlChips(event) {
  const span = spanOf(event)
  const eventDay = span ? isoDay(span.from) : null
  const lastDay = span ? isoDay(span.to) : null
  const samePlanned = event.plannedDate
    && event.plannedDate === eventDay
    // Both sides as a local wall clock: `plannedTime` is now read that way too
    // (notion.js `splitStart`), and comparing it to a raw string slice would make
    // two identical times look different whenever Notion answers in UTC.
    && (!event.plannedTime || !event.hasTime || event.plannedTime === formatTime(event.start))
  return {
    going: Boolean(event.going),
    plannedDate: event.plannedDate && !samePlanned ? event.plannedDate : null,
    hasTickets: Boolean(event.hasTickets),
    dateExpiring: event.dateExpiring && event.dateExpiring !== lastDay ? event.dateExpiring : null,
  }
}

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Two place strings are "the same place" when one contains the other once
 *  folded — `Palatul Suțu` vs `Palatul Suțu, Bd. I.C. Brătianu 2, București`. */
/** Where the one prominent "go there" button should point, or null for no button.
 *
 *  Tickets always earn one — that's the action the whole screen is building to.
 *  A plain event link earns one only when it's a destination the provenance list
 *  doesn't already offer; when the event's link IS one of its sources (common,
 *  since a Radar row's `Link` is often the article it was found in), the button
 *  was just a second, larger copy of a link an inch above it. */
export function goUrlFor(event) {
  if (event.tickets) return event.tickets
  if (!event.link) return null
  const dup = (event.sources ?? []).some((s) => s.url === event.link)
  return dup ? null : event.link
}

/** `altundeva` is the Area vocabulary's "no neighbourhood applies" — a filter
 *  value, not a location. Printed under the address it reads as a place name and
 *  tells the reader nothing, so it's suppressed wherever Area is displayed. */
export function areaLabel(area) {
  return area && area !== 'altundeva' ? area : null
}

/** Provenance is who TOLD you about this — an article, a newsletter, a
 *  recommendation. Your own Wanderlist row is not a source; it's the outcome of
 *  having read one. Listing it under "de unde știm" put the word Wanderlist on
 *  screen a fourth time and pointed at a raw Notion page. */
export function provenanceSources(event) {
  return (event.sources ?? []).filter((s) => s.kind !== 'saved')
}

function sameplace(a, b) {
  const fa = fold(a)
  const fb = fold(b)
  if (!fa || !fb) return false
  return fa === fb || fa.includes(fb) || fb.includes(fa)
}

export function EventDetail({ event, now, onClose, onSave, onDismiss, saving }) {
  const t = useT()
  const sigs = signalsFor(event)
  const fresh = freshness(event, now)
  const sources = provenanceSources(event)
  const findingsUrl = event.sources.find((s) => s.kind === 'saved')?.url ?? null
  // Into the Wanderlist APP. The Notion page is only the fallback for a row whose
  // id we can't build a deep link from.
  const wanderlistUrl = appUrlFor(event) ?? findingsUrl
  const mapUrl = mapUrlFor(event)
  const free = sigs.includes('free')
  const showAddress = Boolean(event.address) && !sameplace(event.venue, event.address)
  const area = areaLabel(event.area)
  const goUrl = goUrlFor(event)
  const span = spanOf(event)
  // A date RANGE has no start time to be unsure about — a festival simply runs
  // for three days. The note belongs only to a single dated day with no hour.
  const timeUnknown = Boolean(span) && !event.hasTime && span.to.getTime() === span.from.getTime()
  const showCost = free || typeof event.cost === 'number'
  const chips = wlChips(event)
  const anyChip = chips.going || chips.plannedDate || chips.hasTickets || chips.dateExpiring

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={event.name}>
      <div className="detailInner">
        {/* Two destructive-looking glyphs side by side told you nothing about
            which was which. Both now carry a word: one navigates, one hides. */}
        <div className="detailBar">
          <button type="button" className="barBtn" onClick={onClose}>
            <BackIcon /> <span>{t('detail.back')}</span>
          </button>
          {!event.saved && (
            <button type="button" className="barBtn danger" onClick={() => onDismiss(event)}>
              <HideIcon /> <span>{t('detail.hide')}</span>
            </button>
          )}
        </div>

        {event.image && <img className="detailHero" src={event.image} alt="" loading="lazy" />}

        <h1 className="detailName">{event.name}</h1>

        {/* Uncertainty is stated in words rather than implied by a dimmed pixel. */}
        {event.confidence === 'uncertain' && (
          <p className="notice warn">{t('detail.uncertain')}</p>
        )}

        <dl>
          <div className="detailRow">
            <dt>{t('detail.when')}</dt>
            <dd>{formatWhen(event, now, t)}{timeUnknown && <span style={{ color: 'var(--color-faint)' }}> · {t('detail.timeUnconfirmed')}</span>}</dd>
          </div>
          {(event.venue || event.address) && (
            <div className="detailRow">
              <dt>{t('detail.where')}</dt>
              <dd>
                {event.venue}
                {/* A Radar row often carries the full address in BOTH `Venue` and
                    `Address`, and a Findings row has only one combined `Place`.
                    Rendering both verbatim printed the same line twice. */}
                {showAddress && <div style={{ color: 'var(--color-muted)' }}>{event.address}</div>}
                {area && <div style={{ color: 'var(--color-faint)' }}>{area}</div>}
                {mapUrl && <div><a href={mapUrl} target="_blank" rel="noreferrer">{t('detail.openMaps')} <ExternalIcon /></a></div>}
              </dd>
            </div>
          )}
          {/* No cost row at all when the price is unknown — a row reading "Preț
              necunoscut" is a line of screen spent saying nothing. */}
          {showCost && (
            <div className="detailRow">
              <dt>{t('detail.cost')}</dt>
              <dd>{free ? t('detail.free') : t('card.lei', { n: event.cost })}</dd>
            </div>
          )}
          {event.organizer && (
            <div className="detailRow"><dt>{t('detail.who')}</dt><dd>{event.organizer}</dd></div>
          )}
        </dl>

        {event.summary && <p className="detailSummary">{event.summary}</p>}

        {sigs.length > 0 && (
          <div className="cardFoot" style={{ marginTop: 'var(--space-md)' }}>
            {sigs.map((s) => <span key={s} className={`badge ${s}`}>{signalLabel(s, t)}</span>)}
          </div>
        )}

        {/* ── Provenance. The part no other app in the ecosystem can show. ──
            The named-recommenders sentence that used to sit above this said the
            same thing the list says, with each recommender already labelled
            `recomandare` on its own row. */}
        {sources.length > 0 && (
          <>
            <h2 className="sectionTitle">{t('detail.provenance')}</h2>
            <ul className="sources">
              {sources.map((s, i) => (
                <li key={`${s.name}-${i}`} className={`source ${s.kind}`}>
                  <span>
                    {s.url
                      ? <a href={s.url} target="_blank" rel="noreferrer">{s.name} <ExternalIcon /></a>
                      : s.name}
                    {s.date && <span style={{ color: 'var(--color-faint)' }}> · {s.date}</span>}
                  </span>
                  <span className="sourceKind">{kindLabel(s.kind, t)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Staleness is only worth stating when it's a warning. On a row checked
            this week it was a line of small print restating "everything normal". */}
        {(fresh.state === 'stale' || fresh.state === 'unknown') && (
          <p className="provenanceNote">
            {fresh.state === 'unknown'
              ? t('detail.neverChecked')
              : `${t('detail.checkedAgo', { when: relativeDays(stalenessDays(event, now), t) })} ${t('detail.mayBeStale')}`}
          </p>
        )}

        {/* What you already decided, so the basics don't require opening
            Wanderlist. Only the decisions actually MADE: "Încă nedecis" beside
            "fără dată planificată" was two chips agreeing that nothing had
            happened yet, which the absence of chips says by itself. */}
        {event.saved && anyChip && (
          <div className="wlState">
            {chips.going && <span className="wlChip on"><CheckIcon /> {t('wl.going')}</span>}
            {chips.plannedDate && (
              <span className="wlChip">
                <CalendarIcon /> {formatWhenDate({ start: event.plannedTime ? `${chips.plannedDate}T${event.plannedTime}` : chips.plannedDate, hasTime: Boolean(event.plannedTime) }, now, t)}
              </span>
            )}
            {chips.hasTickets && <span className="wlChip gold">{t('wl.hasTickets')}</span>}
            {/* Said the way every other date on this screen is said. A chip
                reading `expiră 2026-08-26` next to one reading `azi, 21:00` was
                the database's spelling sitting beside the human one. */}
            {chips.dateExpiring && (
              <span className="wlChip">{t('wl.expires', { date: dayMonth(parseDay(chips.dateExpiring), t('__lang__')) })}</span>
            )}
          </div>
        )}

        {/* One row, every entry in it something you can actually press.
            ANCHORS, not `window.open`: Radar-B is launched from The Cabinet into
            an Android Custom Tab, where a scripted `window.open` is silently
            swallowed — which is exactly why both of these buttons did nothing on
            a phone while "Deschide în Maps", a plain link, always worked. A
            navigation the user initiated by tapping a link is never blocked. */}
        <div className="actions">
          {goUrl && (
            <a className="actionBtn outline" href={goUrl} target="_blank" rel="noopener noreferrer">
              {event.tickets ? t('detail.tickets') : t('detail.eventPage')}
            </a>
          )}
          {event.saved
            ? (wanderlistUrl && (
              // Same-origin and deliberately IN-TAB: Wanderlist is the next step
              // of one errand, and the back button returns here. A new tab would
              // strand the reader in a second copy of the site.
              <a className="actionBtn primary" href={wanderlistUrl}>{t('wl.open')}</a>
            ))
            : <Button onClick={() => onSave(event)} disabled={saving}>{saving ? t('detail.saving') : t('detail.save')}</Button>}
        </div>
      </div>
    </div>
  )
}
