import { useState, useRef, useEffect } from 'react'
import { ListIcon, CalendarIcon, MapIcon, GuideIcon, GearIcon, PlusIcon, MoreIcon, CloseIcon, SearchIcon, SortIcon, SunIcon, MoonIcon, CheckIcon } from './icons.jsx'
import { SCOPES, STATUSES, SORTS } from './search.js'

const GUIDE_URL = '/wanderlist-guide.html'

// The three ways to look at the backlog. Order matters — List is home.
const VIEWS = [
  { id: 'list', Icon: ListIcon, label: 'List' },
  { id: 'calendar', Icon: CalendarIcon, label: 'Calendar' },
  { id: 'map', Icon: MapIcon, label: 'Map' },
]

// The slim sticky bar. Two clear zones, left→right: WHAT you're looking at (status filter +
// view switcher) on the left, and the TOOLS to act (search · sort · add · app menu) on the
// right. Search is a focused mode — opening it hides the left zone and grows the field, so
// everything stays on one row even inside the 860px column. On phones the status segment
// collapses to a dropdown and the app icons collapse to a ⋯ menu; the view switcher and the
// primary tools stay visible.
export default function MenuBar({ status, onStatus, query, scope, onQuery, onScope, sort, onSort, view, onView, onAdd, onSettings, themeMode, themeName, onCycleTheme }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const dark = themeMode !== 'light'
  const searchActive = searchOpen || query.trim().length > 0
  const currentStatus = STATUSES.find(s => s.value === status) || STATUSES[0]
  const currentSort = SORTS.find(s => s.value === sort) || SORTS[0]

  // Focus the field the moment search expands.
  useEffect(() => { if (searchActive) searchRef.current?.focus() }, [searchActive])

  const appActions = [
    { key: 'theme', Icon: dark ? SunIcon : MoonIcon, label: 'Theme', onClick: onCycleTheme, title: `${themeName} — tap to cycle themes` },
    { key: 'guide', Icon: GuideIcon, label: 'Guide', href: GUIDE_URL, title: 'How to use Wanderlist' },
    { key: 'settings', Icon: GearIcon, label: 'Settings', onClick: onSettings, title: 'Connect to Notion & reminders' },
  ]

  // Only closes via the explicit ✕ (never on blur — so tapping the scope <select> inside the
  // field can't yank the whole search UI away).
  function closeSearch() { onQuery(''); setSearchOpen(false) }

  return (
    <nav className="menubar">
      <div className={`menubar-inner${searchActive ? ' searching' : ''}`}>
        {/* Status filter — desktop segment */}
        <div className="seg" role="tablist" aria-label="Status filter">
          {STATUSES.map(s => (
            <button key={s.value} className={status === s.value ? 'active' : ''} aria-selected={status === s.value} onClick={() => onStatus(s.value)}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Status filter — mobile dropdown */}
        <div className="status-overflow">
          <button className="pill-btn" onClick={() => setStatusOpen(o => !o)} aria-haspopup="menu" aria-expanded={statusOpen} aria-label="Change status filter">
            <span>{currentStatus.label}</span><span className="caret" />
          </button>
          {statusOpen && (
            <>
              <div className="more-scrim" onClick={() => setStatusOpen(false)} />
              <div className="more-menu left" role="menu">
                {STATUSES.map(s => (
                  <button key={s.value} role="menuitem" className={status === s.value ? 'active' : ''} onClick={() => { setStatusOpen(false); onStatus(s.value) }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* View switcher — List / Calendar / Map. Map hides on phones (see CSS) where it
            won't fit, and reappears inside the ⋯ menu instead. */}
        <div className="view-switch" role="tablist" aria-label="View">
          {VIEWS.map(v => (
            <button key={v.id} className={`${view === v.id ? 'active' : ''}${v.id === 'map' ? ' view-map-btn' : ''}`} aria-selected={view === v.id} onClick={() => onView(v.id)} title={v.label} aria-label={v.label}>
              <v.Icon />
            </button>
          ))}
        </div>

        {/* Tools */}
        <div className="menu-actions">
          {searchActive ? (
            <div className="search-wrap">
              <select className="scope" value={scope} onChange={e => onScope(e.target.value)} aria-label="Search scope">
                {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input
                ref={searchRef}
                className="search-input"
                type="search"
                value={query}
                placeholder="search…"
                onChange={e => onQuery(e.target.value)}
                autoComplete="off"
                spellCheck="false"
                aria-label="Search your list"
              />
              <button type="button" className="search-clear" onMouseDown={e => e.preventDefault()} onClick={closeSearch} aria-label="Close search"><CloseIcon /></button>
            </div>
          ) : (
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search"><SearchIcon /></button>
          )}

          {/* Sort: only in the list view (calendar/map place things themselves) */}
          {view === 'list' && (
            <div className="sort-wrap">
              <button className="icon-btn" onClick={() => setSortOpen(o => !o)} aria-haspopup="menu" aria-expanded={sortOpen} aria-label="Sort order" title={`Sort: ${currentSort.label}`}><SortIcon /></button>
              {sortOpen && (
                <>
                  <div className="more-scrim" onClick={() => setSortOpen(false)} />
                  <div className="more-menu" role="menu">
                    {SORTS.map(s => (
                      <button key={s.value} role="menuitem" className={sort === s.value ? 'active' : ''} onClick={() => { setSortOpen(false); onSort(s.value) }}>
                        {sort === s.value ? <CheckIcon /> : <span style={{ width: '1em' }} />} {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button className="btn-today" onClick={onAdd} title="Add something to your list"><PlusIcon /> <span>Add</span></button>

          {/* Desktop: app actions inline */}
          <div className="actions-inline">
            {appActions.map(a => a.href
              ? <a key={a.key} className="icon-btn" href={a.href} target="_blank" rel="noopener" aria-label={a.label} title={a.title}><a.Icon /></a>
              : <button key={a.key} className="icon-btn" onClick={a.onClick} aria-label={a.label} title={a.title}><a.Icon /></button>
            )}
          </div>

          {/* Mobile: one ⋯ button opening a popover. Map lives here on phones (where the
              switcher drops it), above the app actions with a divider. */}
          <div className="actions-overflow">
            <button className="icon-btn" onClick={() => setMoreOpen(o => !o)} aria-haspopup="menu" aria-expanded={moreOpen} aria-label="More actions"><MoreIcon /></button>
            {moreOpen && (
              <>
                <div className="more-scrim" onClick={() => setMoreOpen(false)} />
                <div className="more-menu" role="menu">
                  <button role="menuitem" className={`menu-map${view === 'map' ? ' active' : ''}`} onClick={() => { setMoreOpen(false); onView('map') }}><MapIcon /> Map</button>
                  <div className="more-divider" />
                  {appActions.map(a => a.href
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
