import { useState } from 'react'
import { ArrowUp, ArrowDown, X, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { Button, ConfirmModal, Field, Modal } from '../../ds'
import { hrefOf, navigate } from '../app/router'
import { useStillflow } from '../app/state'
import { StartPractice } from '../components/StartPractice'
import { Empty } from '../components/ui'
import type { UserCollection } from '../domain/types'
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
            <p className={s.kicker}>My collections</p>
            <h1 className={s.pageTitle}>Your own sequences</h1>
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

export function CollectionDetail({ id }: { id: string }) {
  const { collections, byId, saveCollection, deleteCollection, toast, ready } = useStillflow()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
    update(ids)
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
            <button type="button" className={s.iconBtn} aria-label="Rename collection" onClick={() => setRenaming(true)}><Pencil size={17} /></button>
            <button type="button" className={s.iconBtn} aria-label="Delete collection" onClick={() => setDeleting(true)}><Trash2 size={17} /></button>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <Empty title="This collection is empty">
          <p>Open any session and choose Add to collection.</p>
          <a className={s.textLink} href="#/explore">Explore sessions</a>
        </Empty>
      ) : (
        <>
          <section className={s.seq} aria-label="Play in sequence">
            <span className={s.kicker} style={{ margin: 0 }}>Play in sequence · {pos + 1} of {items.length}</span>
            <strong style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.15rem' }}>{items[pos].title}</strong>
            <div className={s.row}>
              <StartPractice session={items[pos]} compact label="Start this one" />
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
                <button type="button" className={s.iconBtn} aria-label={`Remove ${x.title}`} onClick={() => { update(items.filter((y) => y.id !== x.id).map((y) => y.id)); toast(`Removed ${x.title}`) }}><X size={16} /></button>
              </div>
            </div>
          ))}
          {missing > 0 && (
            <p className={s.muted} style={{ marginTop: 'var(--space-md)' }}>
              {missing} {missing === 1 ? 'session is' : 'sessions are'} no longer in the catalogue.{' '}
              <button type="button" className={s.textLink} onClick={() => update(items.map((y) => y.id))}>Tidy up</button>
            </p>
          )}
        </>
      )}

      {renaming && <NameModal open initial={c.name} title="Rename collection" onClose={() => setRenaming(false)}
        onSave={(name) => { saveCollection({ ...c, name, updatedAt: new Date().toISOString() }); setRenaming(false) }} />}
      <ConfirmModal isOpen={deleting} title="Delete this collection?" message={`“${c.name}” will be removed. The sessions in it stay in your library.`}
        confirmText="Delete" variant="danger" onCancel={() => setDeleting(false)}
        onConfirm={() => { deleteCollection(c.id); setDeleting(false); navigate({ name: 'collections' }) }} />
    </>
  )
}
