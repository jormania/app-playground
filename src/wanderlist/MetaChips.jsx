import { PlaceIcon } from './icons.jsx'

// Shared presentation of an item's chips, used in list rows and the detail view. Category
// and Tags merge onto one line, in that order (colour tells them apart — Category is plum,
// Tags olive), and Place always sits on its own row underneath, last. When `onChip` is
// given, each value is a button that filters the list by it. Renders nothing when empty.
export default function MetaChips({ category, place, tags = [], onChip }) {
  const topChips = [
    ...(category ? [{ scope: 'category', kind: 'category', value: category }] : []),
    ...(tags || []).map(t => ({ scope: 'tags', kind: 'tag', value: t })),
  ]
  if (topChips.length === 0 && !place) return null

  const chip = ({ scope, kind, value }) => onChip
    ? <button key={`${kind}-${value}`} type="button" className={`chip ${kind}`}
        onClick={e => { e.stopPropagation(); onChip(scope, value) }} title={`Filter by ${value}`}>{value}</button>
    : <span key={`${kind}-${value}`} className={`chip ${kind}`}>{value}</span>

  return (
    <div className="meta">
      {topChips.length > 0 && <div className="meta-row">{topChips.map(chip)}</div>}
      {place && (
        <div className="meta-row place-row">
          <span className="field-label"><PlaceIcon /></span>
          {chip({ scope: 'place', kind: 'place', value: place })}
        </div>
      )}
    </div>
  )
}
