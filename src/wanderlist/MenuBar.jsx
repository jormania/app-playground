import { useState, useRef, useEffect } from 'react'
import { ListIcon, CalendarIcon, GuideIcon, GearIcon, PlusIcon, MoreIcon, CloseIcon, SearchIcon, SortIcon, SunIcon, MoonIcon, CheckCircleIcon, CheckIcon } from './icons.jsx'
import { SCOPES, STATUSES, SORTS } from './search.js'

const GUIDE_URL = '/wanderlist-guide.html'

// The slim sticky bar, kept to a SINGLE row on laptop widths by making the two space-hungry
// controls compact: search is a magnifier that expands into a field only when you want it,
// and sort is a small icon-menu (not a wide dropdown). Left→right: status segment · search ·
// sort · Add · view/theme/guide/settings. On phones the status segment and the app icons
// collapse into ⋯-style menus.
export default function MenuBar({ status, onStatus, query, scope, onQuery, onScope, sort, onSort, view, onToggleView, onAdd, onSettings, themeMode, themeName, onCycleTheme }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const dark = themeMode !== 'light'
  const calendar = view === 'calendar'
  const searchActive = searchOpen || query.trim().length > 0

  // Focus the field the moment search expands.
  useEffect(() => { if (searchActive) searchRef.current?.focus() }, [searchActive])

  const actions = [
    // List ⇄ Calendar toggle: the icon shows the view you'll switch TO.
    { key: 'view', Icon: calendar ? ListIcon : CalendarIcon, label: calendar ? 'List' : 'Calendar', onClick: onToggleView, title: calendar ? 'List view' : 'Calendar view' },
    // Cycles the six palettes (each press flips light↔dark, so the sun/moon glyph — the
    // mode you'll switch TO — stays truthful); the title names the palette you're on.
    { key: 'theme', Icon: dark ? SunIcon : MoonIcon, label: 'Theme', onClick: onCycleTheme, title: `${themeName} — tap to cycle themes` },
    { key: 'guide', Icon: GuideIcon, label: 'Guide', href: GUIDE_URL, title: 'How to use Wanderlist' },
    { key: 'settings', Icon: GearIcon, label: 'Settings', onClick: onSettings, title: 'Connect to Notion & reminders' },
  ]
  const current = STATUSES.find(s => s.value === status) || STATUSES[0]
  const currentSort = SORTS.find(s => s.value === sort) || SORTS[0]

  function collapseSearch() {
    if (!query.trim()) setSearchOpen(false)
  }

  return (
    <nav className="menubar">
      <div className="menubar-inner">
        {/* Desktop: status segmented control */}
        <div className="seg" role="tablist" aria-label="Status">
          {STATUSES.map(s => (
            <button key={s.value} className={status === s.value ? 'active' : ''} aria-selected={status === s.value} onClick={() => onStatus(s.value)}>
              {s.value === 'attended' ? <CheckCircleIcon /> : <ListIcon />}<span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile: status collapses into a small menu */}
        <div className="view-overflow">
          <button className="view-btn" onClick={() => setStatusOpen(o => !o)} aria-haspopup="menu" aria-expanded={statusOpen} aria-label="Change status">
            <span className="view-label">{current.label}</span><span className="caret" />
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

        <div className={`menu-actions${searchActive ? ' searching' : ''}`}>
          {/* Search: a magnifier that expands into a field (and stays open while there's a query) */}
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
                onBlur={collapseSearch}
                autoComplete="off"
                spellCheck="false"
                aria-label="Search your list"
              />
              <button className="search-clear" onClick={() => { onQuery(''); setSearchOpen(false) }} aria-label="Close search"><CloseIcon /></button>
            </div>
          ) : (
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search"><SearchIcon /></button>
          )}

          {/* Sort: compact icon-menu (hidden in calendar view, where sort doesn't apply) */}
          {!calendar && (
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

          <button className="btn-today" onClick={onAdd}><PlusIcon /> <span>Add</span></button>

          {/* Desktop: app actions inline */}
          <div className="actions-inline">
            {actions.map(a => a.href
              ? <a key={a.key} className="icon-btn" href={a.href} target="_blank" rel="noopener" aria-label={a.label} title={a.title}><a.Icon /></a>
              : <button key={a.key} className="icon-btn" onClick={a.onClick} aria-label={a.label} title={a.title}><a.Icon /></button>
            )}
          </div>

          {/* Mobile: one ⋯ button opening a popover of the same app actions */}
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
