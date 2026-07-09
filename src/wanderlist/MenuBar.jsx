import { useState, useRef, useEffect } from 'react'
import { ListIcon, CalendarIcon, GuideIcon, GearIcon, PlusIcon, MoreIcon, CloseIcon, SearchIcon, SortIcon, StatsIcon, SunIcon, MoonIcon, CheckIcon } from './icons.jsx'
import { SCOPES, STATUSES, SORTS } from './search.js'

const GUIDE_URL = '/wanderlist-guide.html'
const VIEWS = [
  { id: 'list', Icon: ListIcon, label: 'List' },
  { id: 'calendar', Icon: CalendarIcon, label: 'Calendar' },
]

// Shared behaviour for the status/sort/⋯ dropdowns: Escape closes and returns focus to
// the button that opened it, and opening one focuses its first item — the same two things
// Modal.jsx already does for the bigger dialogs, brought down to these small popovers too.
function usePopover() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('[role="menuitem"]')?.focus()
    function onKeyDown(e) {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return { open, setOpen, triggerRef, menuRef }
}

// One bar, same on every width. Two packed groups: the view switcher, Search, the To-do
// filter and Sort all sit left-aligned in a fixed order; Add and ⋯ push to the far right
// (via .btn-today's margin-left: auto), with the secondary actions (theme, guide, settings)
// tucked under the ⋯ menu. Search is a focused mode: while the field is open it takes the
// whole row (closes only via its own ✕), everything else hides, and the field grows to fill.
export default function MenuBar({ status, onStatus, query, scope, onQuery, onScope, sort, onSort, view, onView, onAdd, onStats, onSettings, themeMode, themeName, onCycleTheme }) {
  const more = usePopover()
  const statusPop = usePopover()
  const sortPop = usePopover()
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const dark = themeMode !== 'light'
  const searchActive = searchOpen || query.trim().length > 0
  const currentStatus = STATUSES.find(s => s.value === status) || STATUSES[0]
  const currentSort = SORTS.find(s => s.value === sort) || SORTS[0]

  useEffect(() => { if (searchActive) searchRef.current?.focus() }, [searchActive])

  const appActions = [
    { key: 'stats', Icon: StatsIcon, label: 'Stats', onClick: onStats, title: 'Stats' },
    { key: 'theme', Icon: dark ? SunIcon : MoonIcon, label: 'Theme', onClick: onCycleTheme, title: `${themeName} — tap to cycle themes` },
    { key: 'guide', Icon: GuideIcon, label: 'Guide', href: GUIDE_URL, title: 'How to use Wanderlist' },
    { key: 'settings', Icon: GearIcon, label: 'Settings', onClick: onSettings, title: 'Connect to Notion & reminders' },
  ]

  function closeSearch() { onQuery(''); setSearchOpen(false) }

  return (
    <nav className="menubar">
      <div className={`menubar-inner${searchActive ? ' searching' : ''}`}>
        {/* View switcher — far left */}
        <div className="view-switch" role="tablist" aria-label="View">
          {VIEWS.map(v => (
            <button key={v.id} role="tab" className={view === v.id ? 'active' : ''} aria-selected={view === v.id} onClick={() => onView(v.id)} title={v.label} aria-label={v.label}>
              <v.Icon />
            </button>
          ))}
        </div>

        {/* Tools — right-aligned, in the fixed order search · status · sort · add · more */}
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
                onKeyDown={e => { if (e.key === 'Escape') closeSearch() }}
                autoComplete="off"
                spellCheck="false"
                aria-label="Search your list"
              />
              <button type="button" className="search-clear" onMouseDown={e => e.preventDefault()} onClick={closeSearch} aria-label="Close search"><CloseIcon /></button>
            </div>
          ) : (
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search"><SearchIcon /></button>
          )}

          {/* Status filter (To-do / Attended / All) */}
          <div className="status-wrap">
            <button ref={statusPop.triggerRef} className="pill-btn" onClick={() => statusPop.setOpen(o => !o)} aria-haspopup="menu" aria-expanded={statusPop.open} aria-label="Filter by status" title="Filter">
              <span>{currentStatus.label}</span><span className="caret" />
            </button>
            {statusPop.open && (
              <>
                <div className="more-scrim" onClick={() => statusPop.setOpen(false)} />
                <div className="more-menu left" role="menu" ref={statusPop.menuRef}>
                  {STATUSES.map(s => (
                    <button key={s.value} role="menuitem" className={status === s.value ? 'active' : ''} onClick={() => { statusPop.setOpen(false); onStatus(s.value) }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sort — only in the list view (the calendar places things by date) */}
          {view === 'list' && (
            <div className="sort-wrap">
              <button ref={sortPop.triggerRef} className="icon-btn" onClick={() => sortPop.setOpen(o => !o)} aria-haspopup="menu" aria-expanded={sortPop.open} aria-label="Sort order" title={`Sort: ${currentSort.label}`}><SortIcon /></button>
              {sortPop.open && (
                <>
                  <div className="more-scrim" onClick={() => sortPop.setOpen(false)} />
                  <div className="more-menu" role="menu" ref={sortPop.menuRef}>
                    {SORTS.map(s => (
                      <button key={s.value} role="menuitem" className={sort === s.value ? 'active' : ''} onClick={() => { sortPop.setOpen(false); onSort(s.value) }}>
                        {sort === s.value ? <CheckIcon /> : <span style={{ width: '1em' }} />} {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button className="btn-today" onClick={onAdd} title="Add something to your list"><PlusIcon /> <span>Add</span></button>

          {/* ⋯ — theme, guide, settings */}
          <div className="actions-overflow">
            <button ref={more.triggerRef} className="icon-btn" onClick={() => more.setOpen(o => !o)} aria-haspopup="menu" aria-expanded={more.open} aria-label="More"><MoreIcon /></button>
            {more.open && (
              <>
                <div className="more-scrim" onClick={() => more.setOpen(false)} />
                <div className="more-menu" role="menu" ref={more.menuRef}>
                  {appActions.map(a => a.href
                    ? <a key={a.key} role="menuitem" href={a.href} target="_blank" rel="noopener" onClick={() => more.setOpen(false)}><a.Icon /> {a.label}</a>
                    : <button key={a.key} role="menuitem" onClick={() => { more.setOpen(false); a.onClick() }}><a.Icon /> {a.label}</button>
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
