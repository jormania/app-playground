import { ListIcon, CalendarIcon, YearIcon, GuideIcon, GearIcon, PlusIcon, StatsIcon, ExportIcon, CloseIcon } from './icons.jsx'
import { SCOPES } from './search.js'

// The slim sticky bar: view toggle (List · Calendar · Year) · search (with scope) ·
// Today · Stats · Export · Guide · Settings. Wraps gracefully — on narrow screens
// the search drops to its own full-width row while the rest stays on the top line.
export default function MenuBar({ view, onView, query, scope, onQuery, onScope, onToday, onStats, onExport, onSettings }) {
  const seg = (id, Icon, label) => (
    <button className={view === id ? 'active' : ''} aria-selected={view === id} onClick={() => onView(id)}>
      <Icon /><span>{label}</span>
    </button>
  )
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
          <button className="icon-btn" onClick={onStats} aria-label="Stats" title="Stats"><StatsIcon /></button>
          <button className="icon-btn" onClick={onExport} aria-label="Export" title="Export as an HTML file"><ExportIcon /></button>
          <a className="icon-btn" href="/journal-of-delights-guide.html" target="_blank" rel="noopener" aria-label="Guide" title="How to use this journal"><GuideIcon /></a>
          <button className="icon-btn" onClick={onSettings} aria-label="Settings" title="Connect to Notion"><GearIcon /></button>
        </div>
      </div>
    </nav>
  )
}
