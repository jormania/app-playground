import { Modal, Button } from '../ds'
import { SIGNAL_LABELS } from './signals.js'

function Chips({ options, selected, onToggle }) {
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
          {SIGNAL_LABELS[value] ?? value}<span className="n">{count}</span>
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
  { value: null, label: 'orice preț' },
  { value: 0, label: 'gratuit' },
  { value: 50, label: 'până în 50 lei' },
  { value: 100, label: 'până în 100 lei' },
]

function PriceChips({ value, onChange }) {
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
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** One sheet for every facet. Options are counted over the live pool, so a filter
 *  that would return nothing is never offered in the first place. */
export function FilterSheet({ filters, facets, onChange, onClose }) {
  const toggle = (key) => (value) => {
    const list = filters[key]
    onChange({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }
  const active = filters.categories.length + filters.areas.length + filters.signals.length + (filters.maxCost !== null ? 1 : 0)

  return (
    <Modal open onClose={onClose} title="Filtre">
      {facets.categories.length > 0 && <>
        <p className="sectionTitle" style={{ marginTop: 0 }}>Ce fel</p>
        <Chips options={facets.categories} selected={filters.categories} onToggle={toggle('categories')} />
      </>}

      {facets.areas.length > 0 && <>
        <p className="sectionTitle">Unde</p>
        <Chips options={facets.areas} selected={filters.areas} onToggle={toggle('areas')} />
      </>}

      {facets.signals.length > 0 && <>
        <p className="sectionTitle">Semnale</p>
        <Chips options={facets.signals} selected={filters.signals} onToggle={toggle('signals')} />
      </>}

      <p className="sectionTitle">Preț</p>
      <PriceChips value={filters.maxCost} onChange={(maxCost) => onChange({ ...filters, maxCost })} />
      {filters.maxCost !== null && filters.maxCost > 0 && (
        <p className="hint" style={{ margin: '-0.25rem 0 1rem' }}>
          Evenimentele fără preț menționat nu se încadrează automat — sunt excluse, nu presupuse gratuite.
        </p>
      )}

      <div className="actions">
        <Button variant="ghost" onClick={() => onChange({ ...filters, categories: [], areas: [], signals: [], maxCost: null })} disabled={!active}>
          Șterge filtrele
        </Button>
        <Button onClick={onClose}>Gata</Button>
      </div>
    </Modal>
  )
}
