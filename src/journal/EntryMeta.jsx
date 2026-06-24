import { PeopleIcon, TagIcon } from './icons.jsx'

// One shared presentation of People + Tags, used identically in the list rows and
// the single-entry view: a single wrapping line of labelled groups —
// [👥 people  Strangers]   [🏷 tags  Encounter]. Renders nothing if both empty.
export default function EntryMeta({ people = [], tags = [] }) {
  if (people.length === 0 && tags.length === 0) return null
  return (
    <div className="meta-row">
      {people.length > 0 && (
        <span className="meta-group">
          <span className="field-label"><PeopleIcon /> people</span>
          {people.map(p => <span key={p} className="chip person">{p}</span>)}
        </span>
      )}
      {tags.length > 0 && (
        <span className="meta-group">
          <span className="field-label"><TagIcon /> tags</span>
          {tags.map(t => <span key={t} className="chip tag">{t}</span>)}
        </span>
      )}
    </div>
  )
}
