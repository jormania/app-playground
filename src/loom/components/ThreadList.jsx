import { useCallback, useEffect, useRef } from 'react'
import ThreadRow from './ThreadRow.jsx'
import { useDrag } from '../lib/dragContext.jsx'
import { tap } from '../lib/haptics.js'
import styles from './ThreadList.module.css'

// An ordered stack of threads with drag-to-reorder AND cross-column drag. The
// drag lifecycle is owned by the shared DragProvider (see lib/dragContext.jsx),
// so a thread can be flung within this group or onto another day / skein. Each
// list registers itself as a drop container; a gold insertion line marks where
// the dragged thread will land and the source row dims in place — robust on touch
// and mouse alike, no layout maths chasing the finger.
export default function ThreadList({ tasks, containerId, meta, onReorder, onToggle, onDelete, onEdit, renderAssign }) {
  const drag = useDrag()
  const rowRefs = useRef(new Map())
  const listRef = useRef(null)

  const setRowRef = useCallback((id, el) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }, [])

  // Where, in this group's order, would the pointer drop a thread (excluding the
  // dragged one if it lives here)?
  const indexAt = useCallback((clientY, draggingId) => {
    const others = tasks.filter(t => t.id !== draggingId)
    for (let i = 0; i < others.length; i++) {
      const el = rowRefs.current.get(others[i].id)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return others.length
  }, [tasks])

  // Register this list as a drop container for the shared drag controller.
  useEffect(() => {
    if (!drag) return undefined
    return drag.register(containerId, { el: listRef.current, meta, indexAt })
  }, [drag, containerId, meta, indexAt])

  const active = drag && drag.active
  const over = drag && drag.over
  const isTarget = over && over.id === containerId
  const draggingId = active && active.thread.id

  function startDrag(e, thread) {
    e.preventDefault()
    if (drag) { drag.begin(thread, containerId); tap(6) }
  }

  // Keyboard reorder: move a thread one slot up/down within the group.
  function nudge(thread, currentIndex, delta) {
    const target = currentIndex + delta
    if (target < 0 || target > tasks.length - 1) return
    onReorder(thread.id, target)
  }

  return (
    <ul className={`${styles.list} ${isTarget ? styles.target : ''}`} ref={listRef}>
      {tasks.map((thread, i) => (
        <div key={thread.id} ref={el => setRowRef(thread.id, el)} className={styles.slot}>
          {isTarget && over.index === i && draggingId !== thread.id && <div className={styles.caret} aria-hidden="true" />}
          <ThreadRow
            thread={thread}
            index={i}
            dragging={draggingId === thread.id}
            onToggle={done => onToggle(thread.id, done)}
            onDelete={() => onDelete(thread.id)}
            onEdit={title => onEdit(thread.id, title)}
            onNudge={delta => nudge(thread, i, delta)}
            onDragStart={e => startDrag(e, thread)}
            assign={renderAssign ? renderAssign(thread) : null}
          />
        </div>
      ))}
      {isTarget && over.index === tasks.length && <div className={styles.caret} aria-hidden="true" />}
      {isTarget && tasks.length === 0 && <div className={styles.emptyDrop} aria-hidden="true" />}
    </ul>
  )
}
