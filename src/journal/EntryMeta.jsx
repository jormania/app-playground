import { PeopleIcon, TagIcon } from './icons.jsx'

// One shared presentation of People + Tags, used identically in the list rows and
// the single-entry view: a single wrapping line of labelled groups —
// [👥 people  Strangers]   [🏷 tags  Encounter]. Renders nothing if both empty.
// When `onChip` is given, each value becomes a button that filters by it.
export default function EntryMeta({ people = [], tags = [], onChip }) {
  if (people.length === 0 && tags.length === 0) return null

  const chip = (kind, value) => onChip
    ? <button key={`${kind}-${value}`} type="button" className={`chip ${kind}`}
        onClick={e => { e.stopPropagation(); onChip(kind === 'person' ? 'people' : 'tags', value) }}
        title={`Filter by ${value}`}>{value}</button>
    : <span key={`${kind}-${value}`} className={`chip ${kind}`}>{value}</span>

  return (
    <div className="meta-row">
      {people.length > 0 && (
        <span className="meta-group">
          <span className="field-label"><PeopleIcon /> people</span>
          {people.map(p => chip('person', p))}
        </span>
      )}
      {tags.length > 0 && (
        <span className="meta-group">
          <span className="field-label"><TagIcon /> tags</span>
          {tags.map(t => chip('tag', t))}
        </span>
      )}
    </div>
  )
}
