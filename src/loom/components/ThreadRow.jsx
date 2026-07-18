import { useRef, useState } from 'react'
import { heatColor } from '../lib/model.js'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { tap } from '../lib/haptics.js'
import styles from './ThreadRow.module.css'

// One thread. Tactile by design:
//   • swipe RIGHT to weave (complete) · swipe LEFT to unravel (delete)
//   • tap the knot to weave/unweave · tap the title to edit inline
//   • grab the grip to drag-reorder (or focus it and use ↑/↓) — reorder drives
//     the heat colour on the left edge (top = ember, cooling down the group)
// The `assign` render slot carries the per-view reassignment control (a day
// mover in the Weekly view, a skein chip in the List view).
const SWIPE_THRESHOLD = 72

export default function ThreadRow({
  thread, index, onToggle, onDelete, onEdit,
  onNudge, onDragStart, dragging, assign,
}) {
  const { t } = useLexicon()
  const [dx, setDx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(thread.title)
  const gesture = useRef(null)

  const heat = heatColor(index)

  function onBodyPointerDown(e) {
    if (editing) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Never let a swipe start on the row's controls — the grip owns drag-to-move,
    // and the knot / chips / ✂ are taps. Otherwise a leftward grip-drag would cross
    // the swipe-left threshold and unravel the thread mid-move.
    if (e.target.closest('[data-loom-controls]')) return
    gesture.current = { startX: e.clientX, startY: e.clientY, axis: null, id: e.pointerId }
  }
  function onBodyPointerMove(e) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const mx = e.clientX - g.startX
    const my = e.clientY - g.startY
    if (!g.axis) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        g.axis = 'x'
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      } else if (Math.abs(my) > 8) {
        g.axis = 'y' // vertical — hand it back to the scroller
        gesture.current = null
        setDx(0)
        return
      }
    }
    if (g.axis === 'x') {
      e.preventDefault()
      // A little resistance past the threshold so it feels elastic, not loose.
      const clamped = Math.abs(mx) > SWIPE_THRESHOLD
        ? Math.sign(mx) * (SWIPE_THRESHOLD + (Math.abs(mx) - SWIPE_THRESHOLD) * 0.35)
        : mx
      setDx(clamped)
    }
  }
  function onBodyPointerUp(e) {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== 'x') { setDx(0); return }
    const mx = e.clientX - g.startX
    if (mx > SWIPE_THRESHOLD) { tap(10); onToggle(!thread.done) }
    else if (mx < -SWIPE_THRESHOLD) { tap([6, 30, 10]); onDelete() }
    setDx(0)
  }

  function commitEdit() {
    const next = draft.trim()
    if (next && next !== thread.title) onEdit(next)
    else setDraft(thread.title)
    setEditing(false)
  }

  const revealing = dx > 4 ? 'weave' : dx < -4 ? 'unravel' : null

  return (
    <li
      className={`${styles.row} ${thread.done ? styles.woven : ''} ${dragging ? styles.dragging : ''} ${thread.pending ? styles.pending : ''}`}
    >
      {/* Action hints revealed behind the sliding body */}
      <div className={`${styles.behind} ${revealing ? styles[revealing] : ''}`} aria-hidden="true">
        <span className={styles.behindWeave}>✧ {t('weave')}</span>
        <span className={styles.behindUnravel}>{t('unravel')} ✂</span>
      </div>

      <div
        className={styles.body}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        onPointerDown={onBodyPointerDown}
        onPointerMove={onBodyPointerMove}
        onPointerUp={onBodyPointerUp}
        onPointerCancel={() => { gesture.current = null; setDx(0) }}
      >
        <span className={styles.heat} style={{ background: heat, boxShadow: `0 0 10px ${heat}` }} aria-hidden="true" />

        <button
          type="button"
          className={styles.knot}
          data-loom-controls
          aria-pressed={thread.done}
          aria-label={thread.done ? `Un${t('weave')} (mark undone)` : `${t('Weave')} (mark done)`}
          onClick={() => { tap(8); onToggle(!thread.done) }}
        >
          <span className={styles.knotDot} />
        </button>

        {editing ? (
          <input
            className={styles.edit}
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              else if (e.key === 'Escape') { setDraft(thread.title); setEditing(false) }
            }}
          />
        ) : (
          <button
            type="button"
            className={styles.title}
            onClick={() => { setDraft(thread.title); setEditing(true) }}
            title="Tap to edit"
          >
            {thread.title || <span className={styles.untitled}>untitled {t('thread')}</span>}
          </button>
        )}

        <div className={styles.trailing} data-loom-controls>
          {assign}
          <button
            type="button"
            className={styles.unravel}
            aria-label={`${t('Unravel')} (delete)`}
            onClick={() => { tap([6, 30, 10]); onDelete() }}
          >✂</button>
          {onDragStart && (
            <button
              type="button"
              className={styles.grip}
              aria-label="Reorder — drag, or use up and down arrows"
              onPointerDown={e => { if (e.button === 0 || e.pointerType !== 'mouse') { e.stopPropagation(); onDragStart(e) } }}
              onKeyDown={e => {
                if (e.key === 'ArrowUp') { e.preventDefault(); if (onNudge) onNudge(-1) }
                else if (e.key === 'ArrowDown') { e.preventDefault(); if (onNudge) onNudge(1) }
              }}
            >⠿</button>
          )}
        </div>
      </div>
    </li>
  )
}
