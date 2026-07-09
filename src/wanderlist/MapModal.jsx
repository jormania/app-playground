import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import Modal from './Modal.jsx'
import MetaChips from './MetaChips.jsx'
import { HourglassIcon, CalendarIcon } from './icons.jsx'
import { mapEntries } from './mapView.js'
import { cachedGeocode, geocode } from './geocode.js'
import { expiryLabel, formatMedium } from './dates.js'

// Bucharest, as a sensible default centre before any place has resolved.
const DEFAULT_CENTER = [44.4325, 26.1039]

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// A custom teardrop pin as a Leaflet divIcon — our own marker, so every point on the map is
// clearly one of yours (there are no Google markers to clash with; the base map is
// OpenStreetMap). The active entry's pin is larger and gold; the rest are smaller and muted,
// so the one you're looking at stands apart from the others at a glance. Colours are the
// app's own CSS tokens (the map lives under <html data-theme>, so they resolve per palette).
function makeIcon(L, active) {
  const size = active ? 42 : 30
  const color = active ? 'var(--gold)' : 'var(--muted)'
  const html =
    `<span style="color:${color};display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">` +
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">` +
    `<path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 8 12 8 12s8-6.6 8-12c0-4.4-3.6-8-8-8z"/>` +
    `<circle cx="12" cy="10" r="3.1" fill="#fff"/></svg></span>`
  return L.divIcon({ html, className: 'wl-pin', iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size + 4] })
}

// A quick spatial view of the backlog. An OpenStreetMap base map (Leaflet, no API key)
// plots every entry that has a place as its own pin — the active one distinct from the rest
// — with a list beneath, ordered Expiring-first. Places are geocoded once and cached
// (see geocode.js). "Open in Maps" on an entry still opens Google Maps; this in-app view is
// for seeing them all together.
export default function MapModal({ entries, today, onOpen, onClose }) {
  const mapped = useMemo(() => mapEntries(entries, today), [entries, today])
  const [activeId, setActiveId] = useState(mapped[0]?.id ?? null)
  const focus = mapped.find(e => e.id === activeId) || mapped[0] || null

  const containerRef = useRef(null)
  const leafletRef = useRef(null)          // { L, map }
  const markersRef = useRef(new Map())     // id -> { marker, latlng }
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const [ready, setReady] = useState(false)

  // Build the map once, then geocode + drop pins progressively (cached places appear at
  // once; uncached ones trickle in with a polite gap between network calls). Torn down on
  // close so a reopen starts clean.
  useEffect(() => {
    if (!mapped.length || !containerRef.current) return
    let cancelled = false
    let map
    const markers = markersRef.current // stable ref target — captured for the cleanup below
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return
      map = L.map(containerRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      leafletRef.current = { L, map }
      setReady(true)
      setTimeout(() => { if (!cancelled) map.invalidateSize() }, 0)

      for (const e of mapped) {
        if (cancelled) break
        const cached = cachedGeocode(e.place)
        let coords = cached
        if (cached === undefined) {
          coords = await geocode(e.place)
          if (!cancelled && coords !== null) { /* only pause after a real network hit */ }
          if (!cancelled) await new Promise(r => setTimeout(r, 1100))
        }
        if (cancelled || !coords) continue
        const latlng = [coords.lat, coords.lon]
        const marker = L.marker(latlng, { icon: makeIcon(L, e.id === activeIdRef.current) })
          .addTo(map)
          .bindPopup(`<b>${escapeHtml(e.name || 'Untitled')}</b><br>${escapeHtml(e.place)}`)
        marker.on('click', () => setActiveId(e.id))
        markers.set(e.id, { marker, latlng })
        if (e.id === activeIdRef.current) marker.openPopup()
      }

      if (!cancelled && markers.size) {
        const group = L.featureGroup([...markers.values()].map(m => m.marker))
        map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 15 })
      }
    })()

    return () => {
      cancelled = true
      markers.clear()
      leafletRef.current = null
      if (map) map.remove()
    }
  }, [mapped])

  // Restyle pins when the active entry changes (from the list or a marker click), and pan
  // to + open the active one.
  useEffect(() => {
    const lf = leafletRef.current
    if (!lf) return
    for (const [id, { marker, latlng }] of markersRef.current) {
      marker.setIcon(makeIcon(lf.L, id === activeId))
      if (id === activeId) { lf.map.panTo(latlng); marker.openPopup() }
    }
  }, [activeId, ready])

  return (
    <Modal title="Map" onClose={onClose} wide>
      {mapped.length === 0 ? (
        <p>Nothing with a place to map yet — add a place to an entry and it’ll show up here.</p>
      ) : (
        <div className="map-view">
          <div className="map-embed" ref={containerRef} />
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
                    onClick={() => setActiveId(e.id)}
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
