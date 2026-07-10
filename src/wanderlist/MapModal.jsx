import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import MetaChips from './MetaChips.jsx'
import { HourglassIcon, CalendarIcon } from './icons.jsx'
import { mapEntries, embedSrc } from './mapView.js'
import { expiryLabel, formatMedium } from './dates.js'

// A quick spatial view of the backlog: an embedded Google map showing ONE place at a time,
// plus a list of every entry that has a place (Expiring-first). The map opens on the leader
// — the next unattended thing to expire that has a place — and tapping any entry re-centres
// the map on it. Keyless Google embed (maps.google.com/…&output=embed), so no API key or CSP
// allowance is needed; the trade-off (chosen deliberately over a custom multi-pin map) is a
// single pin at a time rather than all places at once — the familiar Google map is worth it.
export default function MapModal({ entries, today, onOpen, onClose }) {
  const mapped = useMemo(() => mapEntries(entries, today), [entries, today])
  const [focusId, setFocusId] = useState(mapped[0]?.id ?? null)
  const focus = mapped.find(e => e.id === focusId) || mapped[0] || null

  return (
    <Modal title="Map" onClose={onClose} wide>
      {mapped.length === 0 ? (
        <p>Nothing with a place to map yet — add a place to an entry and it’ll show up here.</p>
      ) : (
        <div className="map-view">
          <div className="map-embed">
            <iframe
              title={`Map — ${focus?.place || ''}`}
              src={embedSrc(focus)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <ul className="map-list">
            {mapped.map(e => {
              const active = e.id === focus?.id
              const when = e.dateExpiring
                ? expiryLabel(e.dateExpiring, today)
                : e.plannedDate ? `planned ${formatMedium(e.plannedDate)}` : ''
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`map-item${active ? ' active' : ''}`}
                    onClick={() => setFocusId(e.id)}
                    onDoubleClick={() => { onClose(); onOpen(e) }}
                    title={active ? 'Open this entry' : 'Show on the map'}
                  >
                    <span className="map-item-name">{e.name || 'Untitled'}</span>
                    <span className="map-item-place">{e.place}</span>
                    {when && (
                      <span className="map-item-when">
                        {e.dateExpiring ? <HourglassIcon /> : <CalendarIcon />} {when}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {focus && (
            <div className="map-focus-actions">
              <MetaChips category={focus.category} place={focus.place} placeUrl={focus.placeUrl} tags={focus.tags} cost={focus.cost} />
              <button type="button" className="btn btn-sm" onClick={() => { onClose(); onOpen(focus) }}>Open “{focus.name || 'Untitled'}”</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
