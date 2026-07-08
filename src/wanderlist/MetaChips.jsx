import { CategoryIcon, PlaceIcon, TagIcon } from './icons.jsx'

// One shared presentation of Category + Place + Tags, used in list rows and the detail
// view: a wrapping line of labelled chip groups. When `onChip` is given, each value
// becomes a button that filters the list by it. Renders nothing when all are empty.
export default function MetaChips({ category, place, tags = [], onChip }) {
  const hasAny = category || place || (tags && tags.length)
  if (!hasAny) return null

  const chip = (scope, kind, value) => onChip
    ? <button key={`${kind}-${value}`} type="button" className={`chip ${kind}`}
        onClick={e => { e.stopPropagation(); onChip(scope, value) }} title={`Filter by ${value}`}>{value}</button>
    : <span key={`${kind}-${value}`} className={`chip ${kind}`}>{value}</span>

  return (
    <div className="meta-row">
      {category && (
        <span className="meta-group">
          <span className="field-label"><CategoryIcon /></span>
          {chip('category', 'category', category)}
        </span>
      )}
      {place && (
        <span className="meta-group">
          <span className="field-label"><PlaceIcon /></span>
          {chip('place', 'place', place)}
        </span>
      )}
      {tags && tags.length > 0 && (
        <span className="meta-group">
          <span className="field-label"><TagIcon /></span>
          {tags.map(t => chip('tags', 'tag', t))}
        </span>
      )}
    </div>
  )
}
