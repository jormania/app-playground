import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Cross-container drag. One drag can travel from any registered list (a day
// column, the distaff, a skein) onto any other — the tactile upgrade over the
// day-mover chip. The lifecycle lives here, centrally, so there's exactly one set
// of global pointer listeners no matter how many columns are on screen.
//
// Each ThreadList registers itself with an id, its DOM node, some `meta` (what
// kind of container it is — a day, the backlog, a skein) and an `indexAt(clientY,
// draggingId)` that reports where a drop would land within it. On drop, the view
// that owns the provider resolves the move via `onDrop({ thread, fromMeta,
// toMeta, toIndex })` — reordering within, or reassigning day/skein, in one write.

const DragCtx = createContext(null)

export function DragProvider({ children, onDrop }) {
  const containers = useRef(new Map())
  const [active, setActive] = useState(null) // { thread, fromId }
  const [over, setOver] = useState(null)      // { id, index }
  const activeRef = useRef(null)
  const overRef = useRef(null)
  activeRef.current = active
  overRef.current = over

  const register = useCallback((id, api) => {
    containers.current.set(id, api)
    return () => { containers.current.delete(id) }
  }, [])

  const begin = useCallback((thread, fromId) => {
    setActive({ thread, fromId })
    setOver({ id: fromId, index: null })
  }, [])

  useEffect(() => {
    if (!active) return
    function move(e) {
      let found = null
      for (const [id, api] of containers.current) {
        const r = api.el && api.el.getBoundingClientRect()
        if (!r) continue
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          found = { id, index: api.indexAt(e.clientY, active.thread.id) }
          break
        }
      }
      if (found) setOver(found)
    }
    function up() {
      const a = activeRef.current
      const o = overRef.current
      // Only a drop with a resolved landing index counts — a bare press-and-release
      // on the grip (no pointer movement, index still null) must be a no-op, never a
      // silent reorder to the end of the column.
      if (a && o && o.index != null) {
        const from = containers.current.get(a.fromId)
        const to = containers.current.get(o.id)
        if (to && onDrop) {
          onDrop({ thread: a.thread, fromId: a.fromId, toId: o.id, toIndex: o.index, fromMeta: from && from.meta, toMeta: to.meta })
        }
      }
      setActive(null)
      setOver(null)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [active, onDrop])

  return (
    <DragCtx.Provider value={{ register, begin, active, over }}>
      {children}
    </DragCtx.Provider>
  )
}

export function useDrag() {
  return useContext(DragCtx)
}
