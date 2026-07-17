import { useCallback, useEffect, useRef, useState } from 'react'
import ThreadRow from './ThreadRow.jsx'
import { tap } from '../lib/haptics.js'
import styles from './ThreadList.module.css'

// An ordered stack of threads with drag-to-reorder. Reordering only ever moves a
// thread WITHIN this group (a skein in List view, a day in Weekly view); the new
// rank is computed by the parent from the target index. A gold insertion line
// marks where the dragged thread will land, and the source row dims in place —
// robust on touch and mouse alike, no layout maths chasing the finger.
export default function ThreadList({ tasks, onReorder, onToggle, onDelete, onEdit, renderAssign }) {
  const [dragId, setDragId] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const rowRefs = useRef(new Map())
  const listRef = useRef(null)
  const drag = useRef(null)

  const setRowRef = useCallback((id, el) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }, [])

  // Where, in this group's order, would the pointer drop the dragged thread?
  const indexForPointer = useCallback((clientY) => {
    const others = tasks.filter(t => t.id !== drag.current.id)
    for (let i = 0; i < others.length; i++) {
      const el = rowRefs.current.get(others[i].id)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return others.length
  }, [tasks])

  useEffect(() => {
    if (!dragId) return
    function move(e) {
      if (!drag.current) return
      const idx = indexForPointer(e.clientY)
      setOverIndex(idx)
    }
    function up() {
      if (drag.current) {
        const { id, startIndex } = drag.current
        const target = overIndex
        if (target != null && target !== startIndex) { tap(12); onReorder(id, target) }
      }
      drag.current = null
      setDragId(null)
      setOverIndex(null)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragId, overIndex, indexForPointer, onReorder])

  function startDrag(e, thread, startIndex) {
    e.preventDefault()
    drag.current = { id: thread.id, startIndex }
    setDragId(thread.id)
    setOverIndex(startIndex)
    tap(6)
  }

  // Keyboard reorder: move a thread one slot up/down within the group.
  function nudge(thread, currentIndex, delta) {
    const target = currentIndex + delta
    if (target < 0 || target > tasks.length - 1) return
    onReorder(thread.id, target)
  }

  return (
    <ul className={styles.list} ref={listRef}>
      {tasks.map((thread, i) => (
        <div key={thread.id} ref={el => setRowRef(thread.id, el)} className={styles.slot}>
          {dragId && overIndex === i && dragId !== thread.id && <div className={styles.caret} aria-hidden="true" />}
          <ThreadRow
            thread={thread}
            index={i}
            dragging={dragId === thread.id}
            onToggle={done => onToggle(thread.id, done)}
            onDelete={() => onDelete(thread.id)}
            onEdit={title => onEdit(thread.id, title)}
            onNudge={delta => nudge(thread, i, delta)}
            onDragStart={e => startDrag(e, thread, i)}
            assign={renderAssign ? renderAssign(thread) : null}
          />
        </div>
      ))}
      {dragId && overIndex === tasks.length && <div className={styles.caret} aria-hidden="true" />}
    </ul>
  )
}
