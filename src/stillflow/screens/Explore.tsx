import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X, LayoutGrid, List, Heart, Shuffle } from 'lucide-react'
import { Button, Field, Modal } from '../../ds'
import { useStillflow } from '../app/state'
import { SessionCard } from '../components/SessionCard'
import { ChipGroup, Empty, LibraryTabs } from '../components/ui'
import {
  DURATION_BUCKETS, ENERGY, EQUIPMENT, EXPERIENCE, INTENSITY_LABELS, OBJECTIVES, PHYSICAL_FOCUS, STYLES, TIME_OF_DAY,
  repeatLabel,
  type DurationBucketId,
} from '../domain/vocabulary'
import { EMPTY_FILTERS, SORT_OPTIONS, activeFilterCount, applyFilters, type Filters, type SortKey, INTENTIONS, intentionById } from '../lib/filter'
import s from './screens.module.css'

const PAGE = 48

type ListKey = 'styles' | 'focus' | 'objectives' | 'energy' | 'experience' | 'timeOfDay' | 'equipment' | 'series'

export function Explore() {
  const { sessions, filters, setFilters, sort, setSort, userData, lastPractised, preferences, savePreferences } = useStillflow()
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [seed, setSeed] = useState(1)
  const view = preferences.view
  const searchRef = useRef<HTMLInputElement>(null)

  // "/" jumps to search on a keyboard, as on most library sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== '/' || e.metaKey || e.ctrlKey || t?.closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(
    () => applyFilters(sessions, filters, sort, { userData, lastPractised, skipWomenSpecific: preferences.skipWomenSpecific !== false }, seed),
    [sessions, filters, sort, userData, lastPractised, seed, preferences.skipWomenSpecific],
  )
  const series = useMemo(() => [...new Set(sessions.map((x) => x.series).filter((x): x is string => !!x))].sort(), [sessions])
  const update = (patch: Partial<Filters>) => { setFilters({ ...filters, ...patch }); setLimit(PAGE) }
  // A new filter, sort or shuffle is a new list: if you had scrolled down the old
  // one, go back to its top rather than staying somewhere in the middle of it.
  const firstList = useRef(true)
  useEffect(() => {
    if (firstList.current) { firstList.current = false; return }
    if (window.scrollY > 0) window.scrollTo({ top: 0 })
  }, [filters, sort, seed])
  const n = activeFilterCount(filters)

  const intention = filters.intention ? intentionById(filters.intention) : undefined
  const chips: { label: string; remove: () => void }[] = [
    ...(intention ? [{ label: intention.label, remove: () => update({ intention: null }) }] : []),
    ...filters.durations.map((d) => ({ label: DURATION_BUCKETS.find((b) => b.id === d)!.label, remove: () => update({ durations: filters.durations.filter((x) => x !== d) }) })),
    ...(filters.customMin != null ? [{ label: `≥ ${filters.customMin} min`, remove: () => update({ customMin: undefined }) }] : []),
    ...(filters.customMax != null ? [{ label: `≤ ${filters.customMax} min`, remove: () => update({ customMax: undefined }) }] : []),
    ...filters.intensities.map((i) => ({ label: INTENSITY_LABELS[i - 1], remove: () => update({ intensities: filters.intensities.filter((x) => x !== i) }) })),
    ...(['styles', 'focus', 'objectives', 'energy', 'experience', 'timeOfDay', 'equipment', 'series'] as ListKey[]).flatMap((k) =>
      filters[k].map((v) => ({ label: v, remove: () => update({ [k]: filters[k].filter((x) => x !== v) } as Partial<Filters>) }))),
    ...(filters.ratings ?? []).map((r) => ({ label: `Again: ${repeatLabel(r)}`, remove: () => update({ ratings: filters.ratings.filter((x) => x !== r) }) })),
    ...(filters.favouritesOnly ? [{ label: 'Favourites', remove: () => update({ favouritesOnly: false }) }] : []),
  ]

  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v)))

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Explore</h1>
      </header>
      <LibraryTabs on="sessions" />

      <div className={s.toolbar}>
        <label className={s.search}>
          <Search size={18} strokeWidth={1.6} />
          <span className="sf-visually-hidden">Search sessions</span>
          <input ref={searchRef} type="search" enterKeyHint="search" placeholder="Search by title, style, body area, series…" value={filters.query}
            onChange={(e) => update({ query: e.target.value })} />
          {filters.query && <button type="button" className={s.iconBtn} aria-label="Clear search" onClick={() => update({ query: '' })}><X size={16} /></button>}
        </label>
        <div className={s.toolRow}>
          <button type="button" className={s.toolButton} aria-pressed={open} onClick={() => setOpen(true)}>
            <SlidersHorizontal size={15} /> Filters {n > 0 && <span className={s.badge}>{n}</span>}
          </button>
          <button type="button" className={s.toolButton} aria-pressed={filters.favouritesOnly} onClick={() => update({ favouritesOnly: !filters.favouritesOnly })}>
            <Heart size={15} /> Favourites
          </button>
          <label className={s.sortLabel}>
            <span className="sf-visually-hidden">Sort</span>
            <select className={s.select} value={sort} onChange={(e) => { setSort(e.target.value as SortKey); if (e.target.value === 'random') setSeed((x) => x + 1) }}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div className={s.spread}>
          <span className={s.count} aria-live="polite">{results.length} {results.length === 1 ? 'session' : 'sessions'}</span>
          <div className={s.row}>
            {sort === 'random' && (
              <button type="button" className={s.iconBtn} aria-label="Shuffle again" onClick={() => setSeed((x) => x + 1)}><Shuffle size={17} /></button>
            )}
            <button type="button" className={s.iconBtn} aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => savePreferences({ ...preferences, view: 'grid' })}><LayoutGrid size={18} /></button>
            <button type="button" className={s.iconBtn} aria-label="List view" aria-pressed={view === 'list'} onClick={() => savePreferences({ ...preferences, view: 'list' })}><List size={18} /></button>
          </div>
        </div>
        {chips.length > 0 && (
          <div className={s.active}>
            {chips.map((c, i) => (
              <button key={`${c.label}-${i}`} type="button" className={s.activeChip} onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                {c.label} <X size={12} />
              </button>
            ))}
            <button type="button" className={s.textLink} onClick={() => { setFilters(EMPTY_FILTERS); setLimit(PAGE) }}>Clear all</button>
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <Empty title="Nothing matches yet">
          <p>Try fewer filters, or a different word.</p>
          {n > 0 && <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>Clear all filters</Button>}
        </Empty>
      ) : (
        <>
          <div className={view === 'grid' ? s.grid : s.listView}>
            {results.slice(0, limit).map((x) => <SessionCard key={x.id} session={x} layout={view} />)}
          </div>
          {results.length > limit && (
            <div className={s.more}>
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>Show more ({results.length - limit} left)</Button>
            </div>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Filters">
        <div className={s.filterSheet}>
          <ChipGroup<string> label="Practise for" options={[...INTENTIONS.map((i) => i.id), ...(filters.intention?.startsWith('area:') ? [filters.intention] : [])]}
            selected={filters.intention ? [filters.intention] : []}
            onChange={(v) => update({ intention: v.find((x) => x !== filters.intention) ?? null })}
            render={(id) => intentionById(id)?.label ?? id} />
          <ChipGroup<DurationBucketId> label="Length" options={DURATION_BUCKETS.map((b) => b.id)} selected={filters.durations}
            onChange={(v) => update({ durations: v })} render={(id) => DURATION_BUCKETS.find((b) => b.id === id)!.label} />
          <div className={s.rangeRow}>
            <Field label="At least (min)" type="number" inputMode="numeric" min={0} value={filters.customMin ?? ''} onChange={(e) => update({ customMin: num(e.target.value) })} />
            <Field label="At most (min)" type="number" inputMode="numeric" min={0} value={filters.customMax ?? ''} onChange={(e) => update({ customMax: num(e.target.value) })} />
          </div>
          <ChipGroup<number> label="Want to repeat it? (your rating)" options={[5, 4, 3, 2, 1, 0]} selected={filters.ratings ?? []}
            onChange={(v) => update({ ratings: v })} render={(r) => repeatLabel(r)} />
          <ChipGroup label="Style" options={STYLES} selected={filters.styles} onChange={(v) => update({ styles: v })} />
          <ChipGroup<number> label="Intensity" options={[1, 2, 3, 4, 5]} selected={filters.intensities}
            onChange={(v) => update({ intensities: v })} render={(i) => INTENSITY_LABELS[i - 1]} />
          <ChipGroup label="Body area" options={PHYSICAL_FOCUS} selected={filters.focus} onChange={(v) => update({ focus: v })} />
          <ChipGroup label="Goal" options={OBJECTIVES} selected={filters.objectives} onChange={(v) => update({ objectives: v })} />
          <ChipGroup label="Energy and mood" options={ENERGY} selected={filters.energy} onChange={(v) => update({ energy: v })} />
          <ChipGroup label="Level" options={EXPERIENCE} selected={filters.experience} onChange={(v) => update({ experience: v })} />
          <ChipGroup label="Time of day" options={TIME_OF_DAY} selected={filters.timeOfDay} onChange={(v) => update({ timeOfDay: v })} />
          <ChipGroup label="Equipment" options={EQUIPMENT} selected={filters.equipment} onChange={(v) => update({ equipment: v })} />
          {series.length > 0 && <ChipGroup label="Series and programmes" options={series} selected={filters.series} onChange={(v) => update({ series: v })} />}
        </div>
        <div className={s.spread} style={{ marginTop: 'var(--space-md)' }}>
          <button type="button" className={s.textLink} onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}>Clear filters</button>
          <Button onClick={() => setOpen(false)}>Show {results.length} {results.length === 1 ? 'session' : 'sessions'}</Button>
        </div>
      </Modal>
    </>
  )
}
