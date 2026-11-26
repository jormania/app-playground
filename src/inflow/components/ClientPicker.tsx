/**
 * The client field: type to search, pick, or add the name you typed. Replaces a
 * dropdown that would grow to hundreds of one-off clients over the years.
 * With nothing typed it offers the clients paid most recently, then your
 * businesses; individuals quiet for a year are found by searching (lib/clients.ts).
 */
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Client, IncomeRecord } from '../domain/types'
import { clientOptions, suggestClients, type ClientOption } from '../lib/clients'
import { monthShort } from '../lib/dates'
import styles from '../styles/ui.module.css'

export function ClientPicker({ clients, records, today, value, onPick, onCreate, hint, label = 'Client', empty, extras = [], includeArchived = false }: {
  clients: Client[]
  records: IncomeRecord[]
  today: string
  value: string
  onPick: (id: string) => void
  /** Open the new-client form with this name filled in. Without it, nothing new is offered (filters, links). */
  onCreate?: (name: string) => void
  hint?: ReactNode
  label?: string
  /** Shown while no client is chosen: "Any client", "Choose a client…". */
  empty?: string
  /** Choices that aren't a client, listed first: a filter's "No client". */
  extras?: { value: string; label: string }[]
  includeArchived?: boolean
}) {
  const id = useId()
  const listId = `${id}-list`
  const options = useMemo(() => clientOptions(clients, records, today, includeArchived), [clients, records, today, includeArchived])
  const chosen = clients.find((c) => c.id === value) ?? null
  const chosenExtra = extras.find((x) => x.value === value) ?? null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const s = useMemo(() => suggestClients(options, query), [options, query])

  // One flat list for the keyboard: the options shown, then "Add …".
  type Row = { kind: 'client'; o: ClientOption } | { kind: 'add'; name: string } | { kind: 'extra'; value: string; label: string }
  const addName = onCreate ? s.addName : null
  const shownExtras = query.trim() ? [] : extras
  const rows: Row[] = [
    ...shownExtras.map((x) => ({ kind: 'extra' as const, ...x })),
    ...[...s.recent, ...s.businesses, ...s.matches].map((o) => ({ kind: 'client' as const, o })),
    ...(addName ? [{ kind: 'add' as const, name: addName }] : []),
  ]
  const choose = (r: Row) => {
    if (r.kind === 'add') onCreate?.(r.name)
    else if (r.kind === 'extra') onPick(r.value)
    else onPick(r.o.client.id)
    setQuery('')
    setOpen(false)
  }
  const meta = (o: ClientOption) => [o.client.kind === 'business' ? 'business' : '', o.last ? `paid ${monthShort(o.last)} ${o.last.slice(0, 4)}` : 'not paid yet'].filter(Boolean).join(' · ')

  const option = (r: Row, i: number) => (
    <li key={r.kind === 'add' ? 'add' : r.kind === 'extra' ? `x-${r.value}` : r.o.client.id} id={`${id}-o${i}`} role="option" aria-selected={i === active}
      className={`${styles.pickOption} ${i === active ? styles.pickActive : ''}`}
      // Mouse down, not click: picking must happen before the input loses focus and closes the list.
      onMouseDown={(e) => { e.preventDefault(); choose(r) }} onMouseEnter={() => setActive(i)}>
      {r.kind === 'add'
        ? <span className={styles.pickAdd}>+ Add “{r.name}”</span>
        : r.kind === 'extra' ? <span>{r.label}</span>
        : <><span>{r.o.client.name}</span><span className={styles.pickMeta}>{r.o.quiet ? `quiet · ${meta(r.o)}` : meta(r.o)}</span></>}
    </li>
  )
  let i = 0
  const group = (title: string, list: ClientOption[]) => list.length > 0 && (
    <>
      <li role="presentation" className={styles.pickGroup}>{title}</li>
      {list.map((o) => option({ kind: 'client', o }, i++))}
    </>
  )

  return (
    <div className={styles.fieldPlain}>
      <label htmlFor={id} className={styles.fieldLabel}><span>{label}</span></label>
      <div className={styles.pickBox}>
        <input
          ref={input} id={id} name="client" type="text" autoComplete="off" role="combobox"
          aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && rows.length ? `${id}-o${active}` : undefined}
          placeholder={chosen || chosenExtra ? undefined : empty ?? 'Type a name, or pick below'}
          value={open ? query : chosen?.name ?? chosenExtra?.label ?? query}
          onFocus={() => { setOpen(true); setActive(0) }}
          onBlur={() => { setOpen(false); setQuery('') }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(rows.length - 1, a + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
            else if (e.key === 'Enter' && open && rows[active]) { e.preventDefault(); choose(rows[active]) }
            else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
          }}
        />
        {(chosen || chosenExtra) && !open && (
          <button type="button" className={styles.pickClear} aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onPick(''); input.current?.focus() }}><X size={14} aria-hidden /></button>
        )}
        {open && (
          <ul id={listId} role="listbox" aria-label="Clients" className={styles.pickList}>
            {shownExtras.map((x) => option({ kind: 'extra', ...x }, i++))}
            {query.trim()
              ? s.matches.map((o) => option({ kind: 'client', o }, i++))
              : <>{group('Recent', s.recent)}{group('Businesses', s.businesses)}</>}
            {addName && option({ kind: 'add', name: addName }, i++)}
            {!query.trim() && rows.length === shownExtras.length && <li role="presentation" className={styles.pickGroup}>{onCreate ? 'Type a name to add your first client' : 'Type a name to search'}</li>}
            {query.trim() && s.matches.length === 0 && !addName && <li role="presentation" className={styles.pickGroup}>No match</li>}
          </ul>
        )}
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}
