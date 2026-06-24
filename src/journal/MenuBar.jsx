import { useState } from 'react'
import { ListIcon, CalendarIcon, YearIcon, GuideIcon, GearIcon, PlusIcon, StatsIcon, ExportIcon, MoreIcon, CloseIcon } from './icons.jsx'
import { SCOPES } from './search.js'

const GUIDE_URL = '/journal-of-delights-guide.html'

// The slim sticky bar: view toggle (List · Calendar · Year) · search (with scope) ·
// Today · actions. On desktop the actions sit inline; on phones they collapse into
// a ⋯ overflow menu so the whole bar stays one tidy row + a full-width search row.
export default function MenuBar({ view, onView, query, scope, onQuery, onScope, onToday, onStats, onExport, onSettings }) {
  const [moreOpen, setMoreOpen] = useState(false)

  const seg = (id, Icon, label) => (
    <button className={view === id ? 'active' : ''} aria-selected={view === id} onClick={() => onView(id)}>
      <Icon /><span>{label}</span>
    </button>
  )

  // The secondary actions, rendered both inline (desktop) and inside ⋯ (mobile).
  const actions = [
    { key: 'stats', Icon: StatsIcon, label: 'Stats', onClick: onStats, title: 'Stats' },
    { key: 'export', Icon: ExportIcon, label: 'Export', onClick: onExport, title: 'Export as an HTML file' },
    { key: 'guide', Icon: GuideIcon, label: 'Guide', href: GUIDE_URL, title: 'How to use this journal' },
    { key: 'settings', Icon: GearIcon, label: 'Settings', onClick: onSettings, title: 'Connect to Notion' },
  ]

  return (
    <nav className="menubar">
      <div className="menubar-inner">
        <div className="seg" role="tablist" aria-label="View">
          {seg('list', ListIcon, 'List')}
          {seg('calendar', CalendarIcon, 'Calendar')}
          {seg('year', YearIcon, 'Year')}
        </div>

        <div className="search-wrap">
          <select className="scope" value={scope} onChange={e => onScope(e.target.value)} aria-label="Search scope">
            {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input
            className="search-input"
            type="search"
            value={query}
            placeholder="search…"
            onChange={e => onQuery(e.target.value)}
            autoComplete="off"
            spellCheck="false"
            aria-label="Search delights"
          />
          {query && <button className="search-clear" onClick={() => onQuery('')} aria-label="Clear search"><CloseIcon /></button>}
        </div>

        <div className="menu-actions">
          <button className="btn-today" onClick={onToday}><PlusIcon /> <span>Today</span></button>

          {/* Desktop: actions inline */}
          <div className="actions-inline">
            {actions.map(a => a.href
              ? <a key={a.key} className="icon-btn" href={a.href} target="_blank" rel="noopener" aria-label={a.label} title={a.title}><a.Icon /></a>
              : <button key={a.key} className="icon-btn" onClick={a.onClick} aria-label={a.label} title={a.title}><a.Icon /></button>
            )}
          </div>

          {/* Mobile: one ⋯ button opening a popover of the same actions */}
          <div className="actions-overflow">
            <button className="icon-btn" onClick={() => setMoreOpen(o => !o)} aria-haspopup="menu" aria-expanded={moreOpen} aria-label="More actions"><MoreIcon /></button>
            {moreOpen && (
              <>
                <div className="more-scrim" onClick={() => setMoreOpen(false)} />
                <div className="more-menu" role="menu">
                  {actions.map(a => a.href
                    ? <a key={a.key} role="menuitem" href={a.href} target="_blank" rel="noopener" onClick={() => setMoreOpen(false)}><a.Icon /> {a.label}</a>
                    : <button key={a.key} role="menuitem" onClick={() => { setMoreOpen(false); a.onClick() }}><a.Icon /> {a.label}</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
