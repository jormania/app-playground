import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, X, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { Button, ConfirmModal, Field, Modal } from '../../ds'
import { hrefOf, navigate } from '../app/router'
import { useStillflow } from '../app/state'
import { StartPractice } from '../components/StartPractice'
import { Empty } from '../components/ui'
import type { UserCollection } from '../domain/types'
import { fold } from '../lib/filter'
import { readJson, writeJson } from '../../shared/storage'
import s from './screens.module.css'

function NameModal({ open, initial, title, onSave, onClose }: { open: boolean; initial: string; title: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(initial)
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form className={s.stack} onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }}>
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend longer flows" autoFocus />
        <div className={s.row} style={{ justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim()}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

export function Collections() {
  const { collections, byId, saveCollection } = useStillflow()
  const [creating, setCreating] = useState(false)

  const create = (name: string) => {
    const now = new Date().toISOString()
    const c: UserCollection = { id: `c-${Date.now().toString(36)}`, name, sessionIds: [], createdAt: now, updatedAt: now }
    saveCollection(c)
    setCreating(false)
    navigate({ name: 'collection', id: c.id })
  }

  return (
    <>
      <header className={s.pageHead}>
        <div className={s.spread}>
          <div>
            <h1 className={s.pageTitle}>Collections</h1>
            <p className={s.lede}>Your own lists of sessions, in the order you want to practise them.</p>
          </div>
          <Button variant="outline" onClick={() => setCreating(true)}><Plus size={16} /> New collection</Button>
        </div>
      </header>

      {collections.length === 0 ? (
        <Empty title="No collections yet">
          <p>Group sessions the way you think of them: morning mobility, back care, longer weekend flows.</p>
          <Button onClick={() => setCreating(true)}><Plus size={16} /> Create the first one</Button>
        </Empty>
      ) : (
        <div className={s.collections}>
          {collections.map((c) => {
            const items = c.sessionIds.map((id) => byId.get(id)).filter((x) => !!x)
            const minutes = items.reduce((sum, x) => sum + x.durationMinutes, 0)
            return (
              <a key={c.id} href={hrefOf({ name: 'collection', id: c.id })} className={s.collection}>
                <h3>{c.name}</h3>
                <span className={s.muted}>{items.length} {items.length === 1 ? 'session' : 'sessions'} · {minutes} min</span>
                <span className={s.stripe} aria-hidden="true">{items.slice(0, 8).map((x) => <i key={x.id} />)}</span>
              </a>
            )
          })}
        </div>
      )}
      {creating && <NameModal open initial="" title="New collection" onSave={create} onClose={() => setCreating(false)} />}
    </>
  )
}

const SEQ_KEY = 'stillflow:sequence'

/** Add several sessions to a collection without leaving it. */
function AddSessions({ collection, onClose }: { collection: UserCollection; onClose: () => void }) {
  const { sessions, saveCollection } = useStillflow()
  const [q, setQ] = useState('')
  const inIt = new Set(collection.sessionIds)
  const list = useMemo(() => {
    const t = fold(q.trim())
    return sessions.filter((x) => !t || fold(`${x.title} ${x.styles.join(' ')} ${x.physicalFocus.join(' ')}`).includes(t))
      .sort((a, b) => a.title.localeCompare(b.title)).slice(0, 80)
  }, [sessions, q])
  const toggle = (id: string) => saveCollection({
    ...collection,
    sessionIds: inIt.has(id) ? collection.sessionIds.filter((x) => x !== id) : [...collection.sessionIds, id],
    updatedAt: new Date().toISOString(),
  })
  return (
    <Modal open onClose={onClose} title={`Add to ${collection.name}`}>
      <Field label="Search your library" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, style or body area" autoFocus />
      <div className={s.picker}>
        {list.map((x) => (
          <button key={x.id} type="button" className={s.pick} aria-pressed={inIt.has(x.id)} onClick={() => toggle(x.id)}>
            <span>{inIt.has(x.id) ? '✓ ' : ''}{x.title}</span><span className={s.muted}>{x.durationMinutes} min</span>
          </button>
        ))}
      </div>
      <div className={s.row} style={{ justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  )
}

export function CollectionDetail({ id }: { id: string }) {
  const { collections, byId, saveCollection, deleteCollection, toast, ready } = useStillflow()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [positions, setPositions] = useState<Record<string, number>>(() => readJson(SEQ_KEY, {}))
  const c = collections.find((x) => x.id === id)

  if (!c) {
    return ready ? <Empty title="Collection not found"><a className={s.textLink} href="#/collections">All collections</a></Empty> : null
  }

  const items = c.sessionIds.map((sid) => byId.get(sid)).filter((x) => !!x)
  const missing = c.sessionIds.length - items.length
  const minutes = items.reduce((sum, x) => sum + x.durationMinutes, 0)
  const pos = Math.min(positions[c.id] ?? 0, Math.max(0, items.length - 1))
  const setPos = (n: number) => {
    const next = { ...positions, [c.id]: n }
    setPositions(next)
    writeJson(SEQ_KEY, next)
  }
  const update = (sessionIds: string[]) => saveCollection({ ...c, sessionIds, updatedAt: new Date().toISOString() })
  const move = (i: number, d: -1 | 1) => {
    const ids = items.map((x) => x.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    // Ids no longer in the catalogue keep their place at the end until you tidy up.
    update([...ids, ...c.sessionIds.filter((x) => !byId.has(x))])
    if (pos === i) setPos(i + d)
    else if (pos === i + d) setPos(i)
  }

  return (
    <>
      <a className={s.back} href="#/collections"><ArrowLeft size={16} /> Collections</a>
      <header className={s.pageHead}>
        <div className={s.spread}>
          <div>
            <h1 className={s.pageTitle}>{c.name}</h1>
            <p className={s.lede}>{items.length} {items.length === 1 ? 'session' : 'sessions'} · {minutes} min in all</p>
          </div>
          <div className={s.row}>
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus size={15} /> Add sessions</Button>
            <button type="button" className={s.iconBtn} aria-label="Rename collection" onClick={() => setRenaming(true)}><Pencil size={17} /></button>
            <button type="button" className={s.iconBtn} aria-label="Delete collection" onClick={() => setDeleting(true)}><Trash2 size={17} /></button>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <Empty title="This collection is empty">
          <p>Add sessions here, or choose Add to collection on any session.</p>
          <Button onClick={() => setAdding(true)}><Plus size={16} /> Add sessions</Button>
        </Empty>
      ) : (
        <>
          <section className={s.seq} aria-label="Play in sequence">
            <span className={s.kicker} style={{ margin: 0 }}>Play in sequence · {pos + 1} of {items.length}</span>
            <strong style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.15rem' }}>{items[pos].title}</strong>
            <div className={s.row}>
              <StartPractice session={items[pos]} compact label="Start" />
              <Button variant="ghost" size="sm" disabled={pos === 0} onClick={() => setPos(pos - 1)}>Previous</Button>
              <Button variant="ghost" size="sm" disabled={pos >= items.length - 1} onClick={() => setPos(pos + 1)}>Next</Button>
              {pos > 0 && <button type="button" className={s.textLink} onClick={() => setPos(0)}>Start over</button>}
            </div>
          </section>

          {items.map((x, i) => (
            <div key={x.id} className={`${s.item} ${i === pos ? s.current : ''}`}>
              <span className={s.itemIndex}>{i + 1}</span>
              <div>
                <a className={s.itemTitle} href={hrefOf({ name: 'session', id: x.id })}>{x.title}</a>
                <div className={s.entryMeta}>{x.durationMinutes} min · {x.styles[0] ?? 'Style not set'}</div>
              </div>
              <div className={s.itemTools}>
                <button type="button" className={s.iconBtn} aria-label={`Move ${x.title} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
                <button type="button" className={s.iconBtn} aria-label={`Move ${x.title} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
                <button type="button" className={s.iconBtn} aria-label={`Remove ${x.title}`} onClick={() => {
                  const before = c.sessionIds
                  update(before.filter((y) => y !== x.id))
                  toast(`Removed ${x.title}`, { actionLabel: 'Undo', onAction: () => saveCollection({ ...c, sessionIds: before, updatedAt: new Date().toISOString() }) })
                }}><X size={16} /></button>
              </div>
            </div>
          ))}
          {missing > 0 && (
            <p className={s.muted} style={{ marginTop: 'var(--space-md)' }}>
              {missing} {missing === 1 ? 'session is' : 'sessions are'} no longer in the catalogue.{' '}
              <button type="button" className={s.textLink} onClick={() => update(items.map((y) => y.id))}>Remove them from this list</button>
            </p>
          )}
        </>
      )}

      {adding && <AddSessions collection={c} onClose={() => setAdding(false)} />}
      {renaming && <NameModal open initial={c.name} title="Rename collection" onClose={() => setRenaming(false)}
        onSave={(name) => { saveCollection({ ...c, name, updatedAt: new Date().toISOString() }); setRenaming(false) }} />}
      <ConfirmModal isOpen={deleting} title="Delete this collection?" message={`“${c.name}” will be removed. The sessions in it stay in your library.`}
        confirmText="Delete" variant="danger" onCancel={() => setDeleting(false)}
        onConfirm={() => { deleteCollection(c.id); setDeleting(false); navigate({ name: 'collections' }) }} />
    </>
  )
}
