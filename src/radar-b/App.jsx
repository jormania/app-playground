import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { shareNative } from '../shared/share.js'
import { dedupe } from './dedupe.js'
import { isIdea, isNonEvent } from './model.js'
import { dayHeading } from './dates.js'
import { buildStream, facets, emptyFilters, hasActiveFilters, toBrief, VIEWS, viewLabel, inView, matchesFilters, passesIntake } from './search.js'
import { EventCard } from './EventCard.jsx'
import { EventDetail } from './EventDetail.jsx'
import { FilterSheet } from './FilterSheet.jsx'
import { SaveSheet } from './SaveSheet.jsx'
import { SettingsModal } from './SettingsModal.jsx'
import { SearchIcon, FilterIcon, SettingsIcon, GuideIcon, CloseIcon, RadarIcon, UndoIcon, RefreshIcon, BeeMark } from './icons.jsx'
import { useT, LangProvider } from './i18n.js'
import {
  getClient, isLive, loadPrefs, savePrefs, loadLocal, saveLocal, stampFirstSeen,
  readCache, writeCache,
} from './store.js'

function RadarB({ prefs, setPrefs }) {
  const t = useT()
  const [local, setLocal] = useState(loadLocal)
  const [data, setData] = useState(() => readCache() ?? { events: [], saved: [], suggested: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => new Date())

  const [filters, setFilters] = useState(emptyFilters)
  const [searching, setSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [open, setOpen] = useState(null)     // the event whose detail is showing
  const [saving, setSaving] = useState(null) // the event being saved
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [toast, setToast] = useState(null)   // { text, undo?: () => void }
  const searchRef = useRef(null)

  // ── Theme ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  useEffect(() => { savePrefs(prefs) }, [prefs])

  // Keep the document's own language attribute in step, so assistive tech
  // announces the UI in the right voice and the browser stops offering to
  // translate a page that's already in the reader's language.
  useEffect(() => { document.documentElement.lang = prefs.lang }, [prefs.lang])
  useEffect(() => { saveLocal(local) }, [local])

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const client = getClient()
    try {
      // Radar is the only source that can be absent (not configured yet); the
      // other two must not take the whole load down with them either, so each
      // settles independently and the app renders whatever arrived.
      const [events, saved, suggested] = await Promise.all([
        client.listEvents().catch(() => []),
        client.listSaved().catch(() => []),
        client.getSuggested().catch(() => null),
      ])
      const next = { events, saved, suggested }
      setData(next)
      writeCache(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setNow(new Date())
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Refetch when the tab comes back into focus — this is what catches a Radar
  // refresh that happened while the app sat in the background, e.g. a
  // /recommend in Bucharest run in another window. Throttled to once a minute.
  useEffect(() => {
    let last = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      setNow(new Date())
      if (Date.now() - last < 60_000) return
      last = Date.now()
      load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // ── The pool ────────────────────────────────────────────────────────────
  // Radar rows and Wanderlist rows go into ONE pool and are deduped together, so
  // an event you already saved is recognised as the same event rather than
  // appearing twice — and shows as "in your Wanderlist" instead of being offered
  // for saving again.
  //
  // The filter after dedupe is what keeps that cross-reference from becoming an
  // import: a Wanderlist row that matches a Radar row merges into ONE record
  // carrying both ids (mergeCluster's `radarId`) — that one still shows here,
  // now flagged "in your Wanderlist". A Wanderlist row that matches NOTHING —
  // kept from Marquee, or anywhere else Radar itself never surfaced — merges
  // into its own standalone record with `radarId: null`, and that one is
  // dropped here. Radar-B's calendar stays what Radar found; Wanderlist is
  // consulted for cross-reference, not treated as a second source of events.
  const pool = useMemo(
    () => dedupe([...data.events, ...data.saved]).filter((e) => e.radarId),
    [data.events, data.saved],
  )

  useEffect(() => {
    if (!pool.length) return
    setLocal((l) => stampFirstSeen(l, pool.map((e) => e.id)))
  }, [pool])

  const seenIds = useMemo(() => new Set(local.seen), [local.seen])
  const dismissed = useMemo(() => new Set(local.dismissed), [local.dismissed])

  const stream = useMemo(
    () => buildStream(pool, { view: prefs.view, filters, now, intake: prefs.intake, dismissed, seenIds, firstSeen: local.firstSeen }),
    [pool, prefs.view, filters, now, prefs.intake, dismissed, seenIds, local.firstSeen],
  )

  const allFacets = useMemo(() => facets(pool, now, prefs.intake), [pool, now, prefs.intake])

  // What each intake toggle is currently hiding, so Settings can state it rather
  // than leaving you to guess why the stream looks thin.
  const hiddenCounts = useMemo(() => {
    const count = (fn) => pool.filter(fn).length
    return {
      hideAttended: count((e) => e.attended),
      hideDismissed: count((e) => e.dismissed),
      hideIdeas: count((e) => isIdea(e)),
      hideNonEvents: count((e) => isNonEvent(e)),
    }
  }, [pool])

  // Per-lens counts, so the bar shows where things actually are before you tap.
  const counts = useMemo(() => {
    const out = {}
    for (const view of VIEWS) {
      out[view] = pool.filter((e) =>
        passesIntake(e, prefs.intake)
        && !dismissed.has(e.id)
        && inView(e, view, now, { seenIds, firstSeen: local.firstSeen })
        && matchesFilters(e, filters),
      ).length
    }
    return out
  }, [pool, now, prefs.intake, dismissed, seenIds, local.firstSeen, filters])

  // ── Actions ─────────────────────────────────────────────────────────────
  function openEvent(event) {
    setOpen(event)
    // Opening is the "seen" signal — it's what makes "new to you" mean anything.
    setLocal((l) => (l.seen.includes(event.id) ? l : { ...l, seen: [...l.seen, event.id] }))
  }

  /** Dismissal writes to the event's Radar row so it syncs to every device —
   *  localStorage could only ever hide it on the phone that tapped it, which is
   *  exactly the bug this replaces. The local list stays as an instant optimistic
   *  hide and as the fallback for an event that has no Radar row (a Wanderlist-
   *  only entry), which can't be written to. */
  async function setDismissedState(event, dismissed) {
    const optimistic = (l) => ({
      ...l,
      dismissed: dismissed
        ? [...new Set([...l.dismissed, event.id])]
        : l.dismissed.filter((id) => id !== event.id),
    })
    setLocal(optimistic)
    if (!event.radarId) return { synced: false }
    try {
      await getClient().setDismissed(event.radarId, dismissed)
      setData((d) => ({
        ...d,
        events: d.events.map((e) => (e.id === event.radarId ? { ...e, dismissed } : e)),
      }))
      return { synced: true }
    } catch (err) {
      return { synced: false, error: err.message }
    }
  }

  async function dismiss(event) {
    setOpen(null)
    const res = await setDismissedState(event, true)
    setToast({
      text: res.synced
        ? t('toast.hiddenEverywhere')
        : res.error
          ? t('toast.hiddenHereError', { error: res.error })
          : t('toast.hiddenHere'),
      undo: () => { setDismissedState(event, false); setToast({ text: t('toast.restored') }) },
    })
  }

  async function confirmSave(draft) {
    setSaveBusy(true)
    setSaveError(null)
    try {
      const entry = await getClient().saveToWanderlist(draft)
      setData((d) => ({ ...d, saved: [...d.saved, entry] }))
      setSaving(null)
      setOpen(null)
      setToast({ text: t('toast.saved') })
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaveBusy(false)
    }
  }

  async function askRecommender() {
    const text = toBrief(stream, prefs.view, t)
    const res = await shareNative({ name: 'Radar-B', description: text }, 'Radar-B')
    setToast(res.copied ? { text: t('toast.copied') } : res.shared ? null : { text: t('toast.copyFailed') })
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // `notion` used to sit here whenever the app was live and the Suggested page
  // carried no date — a label reporting the NORMAL state, which is the same
  // thing the detail view's "Preț necunoscut" row was doing. Dropped. `demo` is
  // kept because it is abnormal and worth knowing; a real refresh date is kept
  // because it is news. When there is neither, the button shows its glyph and
  // says nothing.
  const refreshedLine = data.suggested?.refreshedAt
    ? t('app.updated', { when: data.suggested.refreshedAt })
    : isLive() ? null : t('app.demo')

  return (
    <div className="app">
      <header className="masthead">
        <div className="mastheadTop">
          {/* The B is a bee — the Eye-Bee-M rebus, played straight. The glyph
              is decorative and `aria-hidden`; the heading's own label carries
              the name, so assistive tech hears "Radar-B" and not a bee. */}
          <h1 className="wordmark" aria-label="Radar-B">
            <span aria-hidden="true">Radar-</span><BeeMark className="wordmarkBee" />
          </h1>
          {/* Tappable rather than a static label — the only other way to force a
              refresh was leaving and returning to the tab. `disabled` while a
              load is already in flight avoids piling up requests on a slow
              connection from a double-tap. */}
          <button
            type="button"
            className="mastheadMeta"
            onClick={load}
            disabled={loading}
            aria-label={t('app.refresh')}
            title={t('app.refresh')}
          >
            {loading ? t('app.refreshing') : (refreshedLine ?? <RefreshIcon />)}
          </button>
          <div className="mastheadActions">
            <button type="button" className="iconBtn" aria-label={t('app.search')} onClick={() => { setSearching((s) => !s); setTimeout(() => searchRef.current?.focus(), 0) }}>
              {searching ? <CloseIcon /> : <SearchIcon />}
            </button>
            <button type="button" className="iconBtn" aria-label={t('app.filters')} onClick={() => setShowFilters(true)} style={hasActiveFilters(filters) ? { color: 'var(--signal)' } : undefined}>
              <FilterIcon />
            </button>
            <a className="iconBtn" href="/radar-b-guide.html" target="_blank" rel="noopener" aria-label={t('app.guide')} title={t('app.guideTitle')}>
              <GuideIcon />
            </a>
            <button type="button" className="iconBtn" aria-label={t('app.settings')} onClick={() => setShowSettings(true)}>
              <SettingsIcon />
            </button>
          </div>
        </div>

        {searching && (
          <div className="searchRow">
            <input
              ref={searchRef}
              className="searchInput"
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder={t('app.searchPlaceholder')}
              enterKeyHint="search"
            />
          </div>
        )}

        <div className="lenses" role="tablist" aria-label={t('app.lenses')}>
          {VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              className="lens"
              aria-selected={prefs.view === view}
              onClick={() => setPrefs((p) => ({ ...p, view }))}
            >
              {viewLabel(view, t)}
              {counts[view] > 0 && <span className="count">{counts[view]}</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="stream">
        {error && <p className="notice warn">{error}</p>}

        {loading && pool.length === 0 && (
          <div className="cards">
            <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
          </div>
        )}

        {!loading && stream.total === 0 && (
          <div className="empty">
            <RadarIcon style={{ color: 'var(--color-faint)' }} />
            <h2>{t('empty.title')}</h2>
            <p>{t(`empty.${prefs.view}`)}</p>
            {hasActiveFilters(filters) && <p>{t('empty.filtersActive')}</p>}
          </div>
        )}

        {stream.days.map((day) => (
          <section key={day.key} className="dayGroup">
            <h2 className="dayHeading">{dayHeading(day.key, now, t)}</h2>
            <div className="cards">
              {day.events.map((event) => (
                <EventCard key={event.id} event={event} now={now} onOpen={openEvent} />
              ))}
            </div>
          </section>
        ))}

        {stream.standing.length > 0 && (
          <section className="dayGroup">
            {/* Long runs and undated things, kept out of the day groups — an
                exhibition open for four months does not belong under "Saturday". */}
            <h2 className="dayHeading">{t('app.anytime')}</h2>
            <div className="cards">
              {stream.standing.map((event) => (
                <EventCard key={event.id} event={event} now={now} onOpen={openEvent} />
              ))}
            </div>
          </section>
        )}

        {stream.total > 0 && (
          <button type="button" className="chip" style={{ alignSelf: 'center' }} onClick={askRecommender}>
            {t('app.askSkill')}
          </button>
        )}

        {data.suggested?.links?.length > 0 && (
          <details>
            <summary className="sectionTitle" style={{ cursor: 'pointer' }}>{t('app.weekSources')}</summary>
            <ul className="sources">
              {data.suggested.links.map((l, i) => (
                <li key={i} className="source">
                  <span>
                    {l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.source}</a> : l.source}
                    {l.pending && <span style={{ color: 'var(--color-faint)' }}> · {t('app.notPublished')}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>

      {toast && (
        <div className="toast">
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" className="toastUndo" onClick={() => { const fn = toast.undo; setToast(null); fn() }}>
              <UndoIcon /> {t('app.undo')}
            </button>
          )}
        </div>
      )}

      {open && (
        <EventDetail
          event={open}
          now={now}
          onClose={() => setOpen(null)}
          onSave={(e) => { setSaveError(null); setSaving(e) }}
          onDismiss={dismiss}
          saving={saveBusy}
        />
      )}

      {saving && (
        <SaveSheet
          event={saving}
          now={now}
          busy={saveBusy}
          error={saveError}
          onCancel={() => setSaving(null)}
          onConfirm={confirmSave}
        />
      )}

      {showFilters && (
        <FilterSheet filters={filters} facets={allFacets} onChange={setFilters} onClose={() => setShowFilters(false)} />
      )}

      {showSettings && (
        <SettingsModal
          theme={prefs.theme}
          onTheme={(theme) => setPrefs((p) => ({ ...p, theme }))}
          lang={prefs.lang}
          onLang={(lang) => setPrefs((p) => ({ ...p, lang }))}
          intake={prefs.intake}
          onIntake={(intake) => setPrefs((p) => ({ ...p, intake }))}
          hiddenCounts={hiddenCounts}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); load() }}
        />
      )}
    </div>
  )
}

/**
 * `App` owns `prefs` and only renders the UI beneath a `LangProvider`.
 *
 * The language has to be readable by `useT()` *above* every component that
 * translates, so it can't live inside the translated tree. Holding all of prefs
 * here keeps one source of truth — an earlier version kept language in App and
 * everything else in RadarB, which needed a polling interval to stay in step.
 */
export default function App() {
  const [prefs, setPrefs] = useState(loadPrefs)
  return (
    <LangProvider lang={prefs.lang}>
      <RadarB prefs={prefs} setPrefs={setPrefs} />
    </LangProvider>
  )
}
