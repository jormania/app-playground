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

/** One sheet for every facet. Options are counted over the live pool, so a filter
 *  that would return nothing is never offered in the first place. */
export function FilterSheet({ filters, facets, onChange, onClose }) {
  const toggle = (key) => (value) => {
    const list = filters[key]
    onChange({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }
  const active = filters.categories.length + filters.areas.length + filters.signals.length

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

      <div className="actions">
        <Button variant="ghost" onClick={() => onChange({ ...filters, categories: [], areas: [], signals: [], maxCost: null })} disabled={!active}>
          Șterge filtrele
        </Button>
        <Button onClick={onClose}>Gata</Button>
      </div>
    </Modal>
  )
}
