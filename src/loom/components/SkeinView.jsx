import { useCallback, useEffect, useRef, useState } from 'react'
import ThreadList from './ThreadList.jsx'
import ThreadRow from './ThreadRow.jsx'
import WovenFold from './WovenFold.jsx'
import QuickAdd from './QuickAdd.jsx'
import SkeinChip from './SkeinChip.jsx'
import { DragProvider } from '../lib/dragContext.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { tap } from '../lib/haptics.js'
import { RhythmIcon } from './icons.jsx'
import {
  groupBySkein, collectSkeins, orderForNew, orderForMove, sortSkeinGroups, matchesQuery,
  rhythmTemplateGroups,
} from '../lib/model.js'
import styles from './SkeinView.module.css'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_FULL   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WORKWEEK   = [0, 1, 2, 3, 4]
const WEEKEND    = [5, 6]

// List view: the same threads, gathered into skeins (projects/categories). Each
// skein is its own ordered stack, dyed by the Ivy-Lee heatmap. Any number of
// skeins may be flagged as rhythms; the wave icon toggles membership. Skeins
// sort by first appearance, plus whatever order you've dragged them into by
// hand (persisted); there's no separate sort MODE to pick — one behaviour,
// always on. Drag the grip to reorder — a real pointer drag (like every other
// drag in Loom), not native HTML5 drag-and-drop, which never worked on touch.
export default function SkeinView({
  threads, actions, filters, onSkeinReorder,
  rhythms, rhythmSkeinNames,
  onToggleRhythm, onSetRhythmDays,
  focusedSkein, onFocusedSkeinClear,
}) {
  const { t } = useLexicon()
  const skeinOrder = filters.skeinOrder || []
  const groups = sortSkeinGroups(groupBySkein(threads), 'manual', skeinOrder)
  const skeins = collectSkeins(threads)
  const [newSkein, setNewSkein] = useState('')
  const sectionRefs = useRef(new Map())

  // Pointer-driven skein-section reordering — same technique as ThreadList's
  // thread drag (pointerdown on the grip, track pointermove, commit on
  // pointerup), scaled up to whole sections instead of rows.
  const [dragSkein, setDragSkein] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const dragRef = useRef(null)

  const nonLooseNames = useCallback(
    () => groups.filter(g => !g.isLoose).map(g => g.skein),
    [groups],
  )

  const indexForPointer = useCallback((clientY) => {
    const names = nonLooseNames().filter(n => n !== dragRef.current)
    for (let i = 0; i < names.length; i++) {
      const el = sectionRefs.current.get(names[i])
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return names.length
  }, [nonLooseNames])

  useEffect(() => {
    if (!dragSkein) return undefined
    function move(e) {
      if (!dragRef.current) return
      setOverIndex(indexForPointer(e.clientY))
    }
    function up() {
      if (dragRef.current) {
        const names = nonLooseNames()
        const from = names.indexOf(dragRef.current)
        const target = overIndex
        if (from >= 0 && target != null) {
          const withoutDragged = names.filter(n => n !== dragRef.current)
          const next = [...withoutDragged]
          next.splice(target, 0, dragRef.current)
          if (JSON.stringify(next) !== JSON.stringify(names) && onSkeinReorder) {
            tap(12)
            onSkeinReorder(next)
          }
        }
      }
      dragRef.current = null
      setDragSkein(null)
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
  }, [dragSkein, overIndex, indexForPointer, nonLooseNames, onSkeinReorder])

  function startSkeinDrag(e, skeinName) {
    e.preventDefault()
    dragRef.current = skeinName
    setDragSkein(skeinName)
    setOverIndex(nonLooseNames().indexOf(skeinName))
    tap(6)
  }

  // When focusedSkein is set (from "Edit in rhythm"), scroll + briefly flash it.
  useEffect(() => {
    if (!focusedSkein) return
    const el = sectionRefs.current.get(focusedSkein)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add(styles.skeinFocused)
      const timer = setTimeout(() => {
        el.classList.remove(styles.skeinFocused)
        if (onFocusedSkeinClear) onFocusedSkeinClear()
      }, 1600)
      return () => clearTimeout(timer)
    }
    if (onFocusedSkeinClear) onFocusedSkeinClear()
  }, [focusedSkein, onFocusedSkeinClear])

  function addTo(skein, title) {
    const group = threads.filter(th => (th.skein || null) === (skein || null))
    actions.addThread({ title, skein: skein || null, day: null, order: orderForNew(group) })
  }

  function handleDrop({ thread, toMeta, toIndex }) {
    const targetTasks = toMeta.tasks || []
    const order = orderForMove(targetTasks, thread.id, toIndex ?? targetTasks.length)
    const targetSkein = toMeta.isLoose ? null : toMeta.skein
    const patch = { order }
    if ((thread.skein || null) !== (targetSkein || null)) patch.skein = targetSkein
    actions.patchThread(thread.id, patch)
  }

  // Get the rhythm entry for a specific skein, if it is a rhythm.
  const getRhythm = (skeinName) => rhythms?.find(r => r.skeinName === skeinName) ?? null
  const inRhythm  = (skeinName) => rhythmSkeinNames?.has(skeinName) ?? false

  // Day-picker helpers
  function toggleDay(skeinName, dayIdx) {
    const entry = getRhythm(skeinName)
    const current = entry?.days || [0, 1, 2, 3, 4, 5, 6]
    let next = current.includes(dayIdx)
      ? current.filter(d => d !== dayIdx)
      : [...current, dayIdx].sort((a, b) => a - b)
    if (next.length === 0) next = [dayIdx]
    onSetRhythmDays(skeinName, next.length === 7 ? null : next)
  }
  function setDayPreset(skeinName, days) {
    onSetRhythmDays(skeinName, days)
  }

  const renderable = groups
    .map(group => {
      const all = group.tasks.filter(th => matchesQuery(th, filters.query))
      // A rhythm skein shows one consolidated row per unique cast thread,
      // regardless of any single instance's done-state — so it never
      // participates in the unwoven-only / fold-woven filtering below (that
      // logic doesn't apply to a summary row with no done-state of its own).
      if (rhythmSkeinNames?.has(group.skein)) return { group, main: all, fold: [] }
      const open = all.filter(th => !th.done)
      const woven = all.filter(th => th.done)
      if (!filters.showWoven) return { group, main: open, fold: [] }
      if (filters.collapseWoven) return { group, main: open, fold: woven }
      return { group, main: all, fold: [] }
    })
    .filter(({ main, fold }) => main.length > 0 || fold.length > 0)

  const nonLoose = renderable.filter(({ group }) => !group.isLoose)

  return (
    <DragProvider onDrop={handleDrop}>
      <div className={styles.view}>
        <div className={styles.composer}>
          <input
            className={styles.skeinName}
            placeholder="Skein…"
            value={newSkein}
            onChange={e => setNewSkein(e.target.value)}
          />
          <div className={styles.composerAdd}>
            <QuickAdd
              placeholder={t('addThread')}
              onAdd={title => {
                addTo(newSkein.trim() || null, title)
                setNewSkein('')
              }}
            />
          </div>
        </div>

        {renderable.length === 0 && (
          <p className={styles.empty}>{filters.query ? 'No threads match your trace.' : t('emptyLoom')}</p>
        )}

        {renderable.map(({ group, main, fold }) => {
          const rhythmEntry = getRhythm(group.skein)
          const isRhythmSkein = inRhythm(group.skein)
          const days = rhythmEntry?.days ?? null
          // Index of this skein within the non-loose, draggable subset (for the
          // insertion caret — loose threads are never a drag target).
          const dragIdx = nonLoose.findIndex(r => r.group.skein === group.skein)
          const showCaretBefore = dragSkein && !group.isLoose && overIndex === dragIdx && dragSkein !== group.skein

          return (
            <div key={group.skein} className={styles.skeinSlot}>
              {showCaretBefore && <div className={styles.skeinCaret} aria-hidden="true" />}
              <section
                className={`${styles.skein} ${dragSkein === group.skein ? styles.skeinDragging : ''}`}
                ref={el => {
                  if (el) sectionRefs.current.set(group.skein, el)
                  else sectionRefs.current.delete(group.skein)
                }}
              >
                <header className={styles.skeinHead}>
                  {!group.isLoose && (
                    <button
                      type="button"
                      className={styles.skeinDragHandle}
                      onPointerDown={e => startSkeinDrag(e, group.skein)}
                      aria-label="Drag to reorder skein"
                      title="Drag to reorder"
                    >⠿</button>
                  )}
                  <h2 className={`${styles.skeinTitle} ${group.isLoose ? styles.loose : ''}`}>
                    {!group.isLoose && isRhythmSkein && <RhythmIcon className={styles.rhythmBadge} />}
                    {group.isLoose ? t('loose') : group.skein}
                  </h2>
                  <span className={styles.count}>{group.tasks.length}</span>
                  {!group.isLoose && onToggleRhythm && (
                    <button
                      type="button"
                      className={`${styles.rhythmBtn} ${isRhythmSkein ? styles.rhythmOn : ''}`}
                      title={isRhythmSkein ? t('unsetRhythm') : t('setAsRhythm')}
                      aria-pressed={isRhythmSkein}
                      onClick={() => onToggleRhythm(group.skein)}
                    ><RhythmIcon /></button>
                  )}
                </header>

                {/* Day picker — compact single-line, shown only when this skein is a rhythm */}
                {isRhythmSkein && (
                  <div className={styles.dayPicker}>
                    {/* Preset pills */}
                    <button
                      type="button"
                      className={`${styles.dayPresetBtn} ${!days ? styles.dayPresetOn : ''}`}
                      onClick={() => setDayPreset(group.skein, null)}
                    >Daily</button>
                    <button
                      type="button"
                      className={`${styles.dayPresetBtn} ${JSON.stringify(days) === JSON.stringify(WORKWEEK) ? styles.dayPresetOn : ''}`}
                      onClick={() => setDayPreset(group.skein, WORKWEEK)}
                    >M–F</button>
                    <button
                      type="button"
                      className={`${styles.dayPresetBtn} ${JSON.stringify(days) === JSON.stringify(WEEKEND) ? styles.dayPresetOn : ''}`}
                      onClick={() => setDayPreset(group.skein, WEEKEND)}
                    >S–S</button>
                    {/* Individual day chips */}
                    {DAY_LABELS.map((lbl, i) => {
                      const on = !days || days.includes(i)
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`${styles.dayChip} ${on ? styles.dayChipOn : ''}`}
                          aria-pressed={on}
                          title={DAY_FULL[i]}
                          onClick={() => toggleDay(group.skein, i)}
                        >{lbl}</button>
                      )
                    })}
                  </div>
                )}

                {isRhythmSkein ? (
                  // One consolidated row per unique cast thread — not one row
                  // per day it's been woven onto. No done-state shown (that's
                  // per-instance and belongs to The Warp); rename/delete act on
                  // every instance sharing the title at once.
                  <ul className={styles.templateList}>
                    {rhythmTemplateGroups(main).map((tpl, i) => (
                      <li key={tpl.title} className={styles.templateSlot}>
                        <ThreadRow
                          thread={{ id: `tpl:${group.skein}:${tpl.title}`, title: tpl.title, done: false }}
                          index={i}
                          hideWeave
                          onToggle={() => {}}
                          onDelete={() => actions.removeRhythmTemplate(group.skein, tpl.title)}
                          onEdit={newTitle => actions.patchRhythmTemplate(group.skein, tpl.title, { title: newTitle })}
                          assign={
                            <span className={styles.templateCount} title={`Cast on ${tpl.count} day${tpl.count === 1 ? '' : 's'} this week`}>
                              ×{tpl.count}
                            </span>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <ThreadList
                      tasks={main}
                      containerId={`skein:${group.skein}`}
                      meta={{ kind: 'skein', skein: group.skein, isLoose: group.isLoose, tasks: main }}
                      onReorder={(id, target) => actions.reorderWithin(group.tasks, id, target)}
                      onToggle={actions.toggleWoven}
                      onDelete={actions.removeThread}
                      onEdit={(id, title) => actions.patchThread(id, { title })}
                      renderAssign={thread => (
                        <SkeinChip
                          thread={thread}
                          skeins={skeins}
                          onSetSkein={skein => actions.patchThread(thread.id, { skein })}
                        />
                      )}
                    />
                    <WovenFold
                      tasks={fold}
                      onToggle={actions.toggleWoven}
                      onDelete={actions.removeThread}
                      onEdit={(id, title) => actions.patchThread(id, { title })}
                    />
                  </>
                )}
                <div className={styles.skeinAdd}>
                  <QuickAdd
                    compact
                    placeholder={t('addThread')}
                    onAdd={title => addTo(group.isLoose ? null : group.skein, title)}
                  />
                </div>
              </section>
              {dragSkein && !group.isLoose && overIndex === nonLoose.length && dragIdx === nonLoose.length - 1 && (
                <div className={styles.skeinCaret} aria-hidden="true" />
              )}
            </div>
          )
        })}
      </div>
    </DragProvider>
  )
}
