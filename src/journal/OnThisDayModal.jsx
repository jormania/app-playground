import { entriesOnSameDay, formatHuman } from './dates.js'
import Modal from './Modal.jsx'
import EntryMeta from './EntryMeta.jsx'

// The "on this day" glance — shown only when the writer chooses to open it, never
// unprompted. Lists past delights that fall on the same calendar day, read-only,
// so revisiting is intentional and doesn't disturb what you're writing.
export default function OnThisDayModal({ entries, dateKey, onClose }) {
  const past = entriesOnSameDay(entries, dateKey)
  return (
    <Modal title="On this day" onClose={onClose} wide>
      {past.length === 0 ? (
        <p>Nothing yet from this day in other years — this may be its first.</p>
      ) : (
        <div className="otd-list">
          {past.map(e => (
            <article key={e.id} className="otd-entry">
              <div className="ev-date">{formatHuman(e.date)}</div>
              <h4>{e.title || 'untitled'}</h4>
              <div className="otd-body">{e.entry}</div>
              <EntryMeta people={e.people} tags={e.tags} />
            </article>
          ))}
        </div>
      )}
    </Modal>
  )
}
