import { Modal, Button } from '../ds'
import { signalLabel } from './signals.js'
import { useT } from './i18n.js'

function Chips({ options, selected, onToggle, t }) {
  return (
    <div className="chipRow">
      {options.map(([value, count]) => (
        <button
          key={value}
          type="button"
          className="chip"
          aria-pressed={selected.includes(value)}
          onClick={() => onToggle(value)}
        >
          {signalLabel(value, t)}<span className="n">{count}</span>
        </button>
      ))}
    </div>
  )
}

/** A price ceiling — single-select, unlike the multi-select facet chips above,
 *  so it needs its own small component rather than reusing Chips. `null` means
 *  no ceiling (every event, priced or not); any other value EXCLUDES unpriced
 *  events on purpose (see matchesFilters) rather than assuming they're cheap,
 *  so the "no ceiling" option is worded to make that plain. */
const PRICE_OPTIONS = [
  { value: null, key: 'filters.anyPrice' },
  { value: 0, key: 'filters.free' },
  { value: 50, key: 'filters.upTo' },
  { value: 100, key: 'filters.upTo' },
]

function PriceChips({ value, onChange, t }) {
  return (
    <div className="chipRow">
      {PRICE_OPTIONS.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className="chip"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {t(opt.key, { n: opt.value })}
        </button>
      ))}
    </div>
  )
}

/** One sheet for every facet. Options are counted over the live pool, so a filter
 *  that would return nothing is never offered in the first place. */
export function FilterSheet({ filters, facets, onChange, onClose }) {
  const t = useT()
  const toggle = (key) => (value) => {
    const list = filters[key]
    onChange({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }
  const active = filters.categories.length + filters.areas.length + filters.signals.length + (filters.maxCost !== null ? 1 : 0)

  return (
    <Modal open onClose={onClose} title={t('filters.title')}>
      {facets.categories.length > 0 && <>
        <p className="sectionTitle" style={{ marginTop: 0 }}>{t('filters.what')}</p>
        <Chips options={facets.categories} selected={filters.categories} onToggle={toggle('categories')} t={t} />
      </>}

      {facets.areas.length > 0 && <>
        <p className="sectionTitle">{t('filters.where')}</p>
        <Chips options={facets.areas} selected={filters.areas} onToggle={toggle('areas')} t={t} />
      </>}

      {facets.signals.length > 0 && <>
        <p className="sectionTitle">{t('filters.signals')}</p>
        <Chips options={facets.signals} selected={filters.signals} onToggle={toggle('signals')} t={t} />
      </>}

      <p className="sectionTitle">{t('filters.price')}</p>
      <PriceChips value={filters.maxCost} onChange={(maxCost) => onChange({ ...filters, maxCost })} t={t} />
      {filters.maxCost !== null && filters.maxCost > 0 && (
        <p className="hint" style={{ margin: '-0.25rem 0 1rem' }}>
          {t('filters.unpricedNote')}
        </p>
      )}

      <div className="actions">
        <Button variant="ghost" onClick={() => onChange({ ...filters, categories: [], areas: [], signals: [], maxCost: null })} disabled={!active}>
          {t('filters.clear')}
        </Button>
        <Button onClick={onClose}>{t('filters.done')}</Button>
      </div>
    </Modal>
  )
}
