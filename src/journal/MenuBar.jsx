import { ListIcon, CalendarIcon, GuideIcon, GearIcon, PlusIcon, StatsIcon, CloseIcon } from './icons.jsx'
import { SCOPES } from './search.js'

// The slim sticky bar: view toggle · search (with scope) · Today · Stats · Guide ·
// Settings. Wraps gracefully — on narrow screens the search drops to its own full
// width row while the toggle and actions stay on the first line.
export default function MenuBar({ view, onView, query, scope, onQuery, onScope, onToday, onStats, onSettings }) {
  return (
    <nav className="menubar">
      <div className="menubar-inner">
        <div className="seg" role="tablist" aria-label="View">
          <button className={view === 'list' ? 'active' : ''} aria-selected={view === 'list'} onClick={() => onView('list')}>
            <ListIcon /><span>List</span>
          </button>
          <button className={view === 'calendar' ? 'active' : ''} aria-selected={view === 'calendar'} onClick={() => onView('calendar')}>
            <CalendarIcon /><span>Calendar</span>
          </button>
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
          <button className="icon-btn" onClick={onStats} aria-label="Stats" title="Stats"><StatsIcon /></button>
          <a className="icon-btn" href="/journal-of-delights-guide.html" target="_blank" rel="noopener" aria-label="Guide" title="How to use this journal"><GuideIcon /></a>
          <button className="icon-btn" onClick={onSettings} aria-label="Settings" title="Connect to Notion"><GearIcon /></button>
        </div>
      </div>
    </nav>
  )
}
