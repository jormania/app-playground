import Modal from './Modal.jsx'
import { TicketIcon } from './icons.jsx'

// Lists every ticket on an entry with more than one, each opening directly in a new tab —
// the direct-open shortcut (see links.js's openTickets) only has an obvious target when
// there's exactly one; with several, there's no single "the" ticket to jump to, so this
// is the quick alternative to opening the full entry just to reach them.
export default function TicketsModal({ entry, onClose }) {
  if (!entry) return null
  return (
    <Modal title={`Tickets — ${entry.name || 'Untitled'}`} onClose={onClose}>
      <ul className="ticket-list plain">
        {(entry.tickets || []).map((t, i) => (
          <li key={i} className="ticket-row">
            <TicketIcon />
            <a href={t.url} target="_blank" rel="noopener" onClick={onClose}>{t.name || `ticket ${i + 1}`}</a>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
