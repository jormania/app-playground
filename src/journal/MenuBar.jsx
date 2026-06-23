import { ListIcon, CalendarIcon, GuideIcon, GearIcon, PlusIcon } from './icons.jsx'

// The slim sticky bar (spec): view toggle + Today + Guide link + settings.
// Stays put while scrolling so the read-view switch is always one tap away.
export default function MenuBar({ view, onView, onToday, onSettings }) {
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
        <div className="menu-actions">
          <button className="btn-today" onClick={onToday}><PlusIcon /> Today</button>
          <a className="icon-btn" href="/journal-of-delights-guide.html" target="_blank" rel="noopener" aria-label="Guide" title="How to use this journal"><GuideIcon /></a>
          <button className="icon-btn" onClick={onSettings} aria-label="Settings" title="Connect to Notion"><GearIcon /></button>
        </div>
      </div>
    </nav>
  )
}
