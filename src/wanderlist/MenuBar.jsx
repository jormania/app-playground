import { useState, useRef, useEffect } from 'react'
import { ListIcon, CalendarIcon, GuideIcon, GearIcon, PlusIcon, MoreIcon, CloseIcon, SearchIcon, SortIcon, StatsIcon, MapIcon, SunIcon, MoonIcon, CheckIcon } from './icons.jsx'
import { SCOPES, STATUSES, FLAGS, SORTS } from './search.js'

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

// One bar, same on every width. Two packed groups: the view switcher, Search, the Filter
// pill and Sort all sit left-aligned in a fixed order; Add and ⋯ push to the far right
// (via .btn-today's margin-left: auto), with the secondary actions (theme, guide, settings)
// tucked under the ⋯ menu. Search is a focused mode: while the field is open it takes the
// whole row (closes only via its own ✕), everything else hides, and the field grows to fill.
// Filter and Sort are two different tools, not one — Filter narrows WHICH entries show
// (Status segment plus the Going-only/Has-tickets toggles), Sort only reorders. Both are
// single popovers, so adding options to either costs zero extra toolbar width regardless of
// screen size — the earlier design questions ("is there room for a Going toggle", "should
// Going/Planned be separate sorts") are resolved by putting everything into the two
// popovers that already exist rather than adding new always-visible controls.
export default function MenuBar({ status, onStatus, query, scope, onQuery, onScope, sort, onSort, goingOnly, onGoingOnly, ticketsOnly, onTicketsOnly, view, onView, onAdd, onMap, onStats, onSettings, themeMode, themeName, onCycleTheme }) {
  const more = usePopover()
  const statusPop = usePopover()
  const sortPop = usePopover()
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const dark = themeMode !== 'light'
  const searchActive = searchOpen || query.trim().length > 0
  const currentStatus = STATUSES.find(s => s.value === status) || STATUSES[0]
  const currentSort = SORTS.find(s => s.value === sort) || SORTS[0]
  const flagValues = { goingOnly, ticketsOnly }
  const flagSetters = { goingOnly: onGoingOnly, ticketsOnly: onTicketsOnly }
  const activeFlags = FLAGS.filter(f => flagValues[f.key])
  const filterLabel = activeFlags.length ? `${currentStatus.label} — ${activeFlags.map(f => f.label).join(', ')}` : currentStatus.label

  useEffect(() => { if (searchActive) searchRef.current?.focus() }, [searchActive])

  const appActions = [
    { key: 'map', Icon: MapIcon, label: 'Map', onClick: onMap, title: 'Map of your places' },
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

          {/* Filter: the Backlog/Ideas/Attended/All segment (mutually exclusive, picking
              one closes the popover) plus two independent Going-only/Has-tickets toggles
              below a divider (ANDed on top of the segment, don't close the popover so both
              can be flipped before dismissing). The pill shows the segment name, with the
              active toggles appended so the compound state stays visible at a glance. */}
          <div className="status-wrap">
            <button ref={statusPop.triggerRef} className={`pill-btn${activeFlags.length ? ' has-flags' : ''}`} onClick={() => statusPop.setOpen(o => !o)} aria-haspopup="menu" aria-expanded={statusPop.open} aria-label={`Filter — ${filterLabel}`} title="Filter">
              <span>{filterLabel}</span><span className="caret" />
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
                  <div className="menu-divider" role="separator" />
                  {FLAGS.map(f => (
                    <button key={f.key} role="menuitem" aria-pressed={flagValues[f.key]} className={flagValues[f.key] ? 'active' : ''} onClick={() => flagSetters[f.key](!flagValues[f.key])}>
                      {flagValues[f.key] ? <CheckIcon /> : <span style={{ width: '1em' }} />} {f.label}
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
