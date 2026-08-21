import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { shareNative } from '../shared/share.js'
import { dedupe } from './dedupe.js'
import { dayHeading } from './dates.js'
import { buildStream, facets, emptyFilters, hasActiveFilters, toBrief, VIEWS, VIEW_LABELS, inView, matchesFilters } from './search.js'
import { EventCard } from './EventCard.jsx'
import { EventDetail } from './EventDetail.jsx'
import { FilterSheet } from './FilterSheet.jsx'
import { SaveSheet } from './SaveSheet.jsx'
import { SettingsModal } from './SettingsModal.jsx'
import { SearchIcon, FilterIcon, SettingsIcon, GuideIcon, CloseIcon, RadarIcon } from './icons.jsx'
import {
  getClient, isLive, loadPrefs, savePrefs, loadLocal, saveLocal, stampFirstSeen,
  readCache, writeCache,
} from './store.js'

const EMPTY_LINES = {
  tonight: 'Nimic în seara asta — încearcă weekendul sau ce e în desfășurare.',
  tomorrow: 'Nimic mâine deocamdată.',
  weekend: 'Weekendul nu s-a umplut încă. Sursele publică joi–vineri.',
  week: 'Săptămâna e goală. Rulează /recommend in Bucharest ca să o populezi.',
  later: 'Nimic programat mai încolo.',
  running: 'Nicio expoziție deschisă acum.',
  new: 'Ai văzut tot ce a apărut la ultima actualizare.',
}

export default function App() {
  const [prefs, setPrefs] = useState(loadPrefs)
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
  const [toast, setToast] = useState(null)
  const searchRef = useRef(null)

  // ── Theme ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  useEffect(() => { savePrefs(prefs) }, [prefs])
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
  const pool = useMemo(
    () => dedupe([...data.events, ...data.saved]),
    [data.events, data.saved],
  )

  useEffect(() => {
    if (!pool.length) return
    setLocal((l) => stampFirstSeen(l, pool.map((e) => e.id)))
  }, [pool])

  const seenIds = useMemo(() => new Set(local.seen), [local.seen])
  const dismissed = useMemo(() => new Set(local.dismissed), [local.dismissed])

  const stream = useMemo(
    () => buildStream(pool, { view: prefs.view, filters, now, dismissed, seenIds, firstSeen: local.firstSeen }),
    [pool, prefs.view, filters, now, dismissed, seenIds, local.firstSeen],
  )

  const allFacets = useMemo(() => facets(pool, now), [pool, now])

  // Per-lens counts, so the bar shows where things actually are before you tap.
  const counts = useMemo(() => {
    const out = {}
    for (const view of VIEWS) {
      out[view] = pool.filter((e) =>
        !dismissed.has(e.id)
        && inView(e, view, now, { seenIds, firstSeen: local.firstSeen })
        && matchesFilters(e, filters),
      ).length
    }
    return out
  }, [pool, now, dismissed, seenIds, local.firstSeen, filters])

  // ── Actions ─────────────────────────────────────────────────────────────
  function openEvent(event) {
    setOpen(event)
    // Opening is the "seen" signal — it's what makes "new to you" mean anything.
    setLocal((l) => (l.seen.includes(event.id) ? l : { ...l, seen: [...l.seen, event.id] }))
  }

  function dismiss(event) {
    setLocal((l) => ({ ...l, dismissed: [...new Set([...l.dismissed, event.id])] }))
    setOpen(null)
    setToast('Ascuns.')
  }

  async function confirmSave(draft) {
    setSaveBusy(true)
    setSaveError(null)
    try {
      const entry = await getClient().saveToWanderlist(draft)
      setData((d) => ({ ...d, saved: [...d.saved, entry] }))
      setSaving(null)
      setOpen(null)
      setToast('Salvat în Wanderlist.')
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaveBusy(false)
    }
  }

  async function askRecommender() {
    const text = toBrief(stream, prefs.view)
    const res = await shareNative({ name: 'Radar-B', description: text }, 'Radar-B')
    setToast(res.copied ? 'Copiat — lipește-l în conversația cu Claude.' : res.shared ? null : 'Nu s-a putut copia.')
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const refreshedLine = data.suggested?.refreshedAt
    ? `actualizat ${data.suggested.refreshedAt}`
    : isLive() ? 'notion' : 'mod demo'

  return (
    <div className="app">
      <header className="masthead">
        <div className="mastheadTop">
          <h1 className="wordmark">Radar<span className="dot">-B</span></h1>
          {/* Tappable rather than a static label — the only other way to force a
              refresh was leaving and returning to the tab. `disabled` while a
              load is already in flight avoids piling up requests on a slow
              connection from a double-tap. */}
          <button
            type="button"
            className="mastheadMeta"
            onClick={load}
            disabled={loading}
            aria-label="Reîmprospătează"
            title="Reîmprospătează"
          >
            {loading ? 'se actualizează…' : refreshedLine}
          </button>
          <div className="mastheadActions">
            <button type="button" className="iconBtn" aria-label="Caută" onClick={() => { setSearching((s) => !s); setTimeout(() => searchRef.current?.focus(), 0) }}>
              {searching ? <CloseIcon /> : <SearchIcon />}
            </button>
            <button type="button" className="iconBtn" aria-label="Filtre" onClick={() => setShowFilters(true)} style={hasActiveFilters(filters) ? { color: 'var(--signal)' } : undefined}>
              <FilterIcon />
            </button>
            <a className="iconBtn" href="/radar-b-guide.html" target="_blank" rel="noopener" aria-label="Ghid" title="Cum funcționează Radar-B">
              <GuideIcon />
            </a>
            <button type="button" className="iconBtn" aria-label="Setări" onClick={() => setShowSettings(true)}>
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
              placeholder="titlu, loc, cartier, sursă…"
              enterKeyHint="search"
            />
          </div>
        )}

        <div className="lenses" role="tablist" aria-label="Perspective">
          {VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              className="lens"
              aria-selected={prefs.view === view}
              onClick={() => setPrefs((p) => ({ ...p, view }))}
            >
              {VIEW_LABELS[view]}
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
            <h2>Liniște</h2>
            <p>{EMPTY_LINES[prefs.view]}</p>
            {hasActiveFilters(filters) && <p>Sau ai filtre active.</p>}
          </div>
        )}

        {stream.days.map((day) => (
          <section key={day.key} className="dayGroup">
            <h2 className="dayHeading">{dayHeading(day.key, now)}</h2>
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
            <h2 className="dayHeading">Oricând</h2>
            <div className="cards">
              {stream.standing.map((event) => (
                <EventCard key={event.id} event={event} now={now} onOpen={openEvent} />
              ))}
            </div>
          </section>
        )}

        {stream.total > 0 && (
          <button type="button" className="chip" style={{ alignSelf: 'center' }} onClick={askRecommender}>
            Întreabă Recommend in Bucharest despre astea
          </button>
        )}

        {data.suggested?.links?.length > 0 && (
          <details>
            <summary className="sectionTitle" style={{ cursor: 'pointer' }}>Din ce s-a construit săptămâna</summary>
            <ul className="sources">
              {data.suggested.links.map((l, i) => (
                <li key={i} className="source">
                  <span>
                    {l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.source}</a> : l.source}
                    {l.pending && <span style={{ color: 'var(--color-faint)' }}> · încă nepublicat</span>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>

      {toast && <p className="notice" style={{ position: 'fixed', bottom: 'calc(var(--space-lg) + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 60 }}>{toast}</p>}

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
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); load() }}
        />
      )}
    </div>
  )
}
