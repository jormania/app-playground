import { useEffect, useRef, useState } from 'react'
import ThreadList from './ThreadList.jsx'
import WovenFold from './WovenFold.jsx'
import QuickAdd from './QuickAdd.jsx'
import SkeinChip from './SkeinChip.jsx'
import { DragProvider } from '../lib/dragContext.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { RhythmIcon } from './icons.jsx'
import {
  groupBySkein, collectSkeins, orderForNew, orderForMove, sortSkeinGroups, matchesQuery,
} from '../lib/model.js'
import styles from './SkeinView.module.css'

const SORTS = [
  { id: 'manual', label: 'Manual' },
  { id: 'heat', label: 'Heat' },
  { id: 'size', label: 'Size' },
  { id: 'name', label: 'Name' },
]

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_FULL   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WORKWEEK   = [0, 1, 2, 3, 4]
const WEEKEND    = [5, 6]

// List view: the same threads, gathered into skeins (projects/categories). Each
// skein is its own ordered stack, dyed by the Ivy-Lee heatmap. Any number of
// skeins may be flagged as rhythms; the wave icon toggles membership. Skeins can
// be dragged into a custom order when the sort is set to Manual.
export default function SkeinView({
  threads, actions, filters, onSkeinSort, onSkeinReorder,
  rhythms, rhythmSkeinNames,
  onToggleRhythm, onSetRhythmDays,
  focusedSkein, onFocusedSkeinClear,
}) {
  const { t } = useLexicon()
  const skeinOrder = filters.skeinOrder || []
  const groups = sortSkeinGroups(groupBySkein(threads), filters.skeinSort, skeinOrder)
  const skeins = collectSkeins(threads)
  const [newSkein, setNewSkein] = useState('')
  const sectionRefs = useRef(new Map())

  // Drag state for skein reordering (only active in 'manual' sort mode).
  const dragSkein = useRef(null)
  const [dragOver, setDragOver] = useState(null)

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

  // Skein-drag handlers: drag the section header to reorder skeins.
  function onSkeinDragStart(e, skeinName) {
    dragSkein.current = skeinName
    e.dataTransfer.effectAllowed = 'move'
  }
  function onSkeinDragOver(e, skeinName) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(skeinName)
  }
  function onSkeinDrop(e, targetSkein) {
    e.preventDefault()
    setDragOver(null)
    if (!dragSkein.current || dragSkein.current === targetSkein) return
    // Build new order: remove from old position, insert before target.
    const nonLoose = groups.filter(g => !g.isLoose).map(g => g.skein)
    const from = nonLoose.indexOf(dragSkein.current)
    const to   = nonLoose.indexOf(targetSkein)
    if (from < 0 || to < 0) return
    const next = [...nonLoose]
    next.splice(from, 1)
    next.splice(to, 0, dragSkein.current)
    if (onSkeinReorder) onSkeinReorder(next)
    dragSkein.current = null
  }
  function onSkeinDragEnd() { setDragOver(null); dragSkein.current = null }

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
      const open = all.filter(th => !th.done)
      const woven = all.filter(th => th.done)
      if (!filters.showWoven) return { group, main: open, fold: [] }
      if (filters.collapseWoven) return { group, main: open, fold: woven }
      return { group, main: all, fold: [] }
    })
    .filter(({ main, fold }) => main.length > 0 || fold.length > 0)

  const canDrag = filters.skeinSort === 'manual'

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

        <div className={styles.sortBar}>
          <span className={styles.sortLabel}>by</span>
          {SORTS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`${styles.sortBtn} ${filters.skeinSort === s.id ? styles.sortOn : ''}`}
              onClick={() => onSkeinSort(s.id)}
            >{s.label}</button>
          ))}
        </div>

        {renderable.length === 0 && (
          <p className={styles.empty}>{filters.query ? 'No threads match your trace.' : t('emptyLoom')}</p>
        )}

        {renderable.map(({ group, main, fold }) => {
          const rhythmEntry = getRhythm(group.skein)
          const isRhythmSkein = inRhythm(group.skein)
          const days = rhythmEntry?.days ?? null

          return (
            <section
              key={group.skein}
              className={`${styles.skein} ${dragOver === group.skein ? styles.skeinDragOver : ''}`}
              ref={el => {
                if (el) sectionRefs.current.set(group.skein, el)
                else sectionRefs.current.delete(group.skein)
              }}
              onDragOver={canDrag && !group.isLoose ? e => onSkeinDragOver(e, group.skein) : undefined}
              onDrop={canDrag && !group.isLoose ? e => onSkeinDrop(e, group.skein) : undefined}
            >
              <header className={styles.skeinHead}>
                {/* Drag handle — only visible in Manual sort */}
                {canDrag && !group.isLoose && (
                  <span
                    className={styles.skeinDragHandle}
                    draggable
                    onDragStart={e => onSkeinDragStart(e, group.skein)}
                    onDragEnd={onSkeinDragEnd}
                    aria-label="Drag to reorder skein"
                    title="Drag to reorder"
                  >⠿</span>
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
              <div className={styles.skeinAdd}>
                <QuickAdd
                  compact
                  placeholder={t('addThread')}
                  onAdd={title => addTo(group.isLoose ? null : group.skein, title)}
                />
              </div>
            </section>
          )
        })}
      </div>
    </DragProvider>
  )
}
