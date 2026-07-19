import { useEffect, useRef, useState } from 'react'
import ThreadList from './ThreadList.jsx'
import WovenFold from './WovenFold.jsx'
import QuickAdd from './QuickAdd.jsx'
import SkeinChip from './SkeinChip.jsx'
import { DragProvider } from '../lib/dragContext.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { RhythmIcon } from './icons.jsx'
import {
  groupBySkein, collectSkeins, orderForNew, orderForMove, sortSkeinGroups, matchesQuery, topOfGroup,
} from '../lib/model.js'
import styles from './SkeinView.module.css'

const SORTS = [
  { id: 'manual', label: 'Manual' },
  { id: 'heat', label: 'Heat' },
  { id: 'size', label: 'Size' },
  { id: 'name', label: 'Name' },
]

// Weekday labels (0 = Mon … 6 = Sun) — short enough to fit in the day-picker chips.
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WORKWEEK = [0, 1, 2, 3, 4]
const WEEKEND = [5, 6]
const ALL_DAYS = null

// List view: the same threads, gathered into skeins (projects/categories). Each
// skein is its own ordered stack, dyed by the Ivy-Lee heatmap. A skein-and-thread
// composer up top starts new work; every skein has its own inline adder. Search,
// the focus toggles and the group-sort all sharpen it without adding columns.
export default function SkeinView({
  threads, actions, filters, onSkeinSort,
  rhythmSkein, rhythmDays, onSetRhythm,
  focusedSkein, onFocusedSkeinClear,
}) {
  const { t } = useLexicon()
  const groups = sortSkeinGroups(groupBySkein(threads), filters.skeinSort)
  const skeins = collectSkeins(threads)
  const [newSkein, setNewSkein] = useState('')
  const sectionRefs = useRef(new Map())

  // When a focusedSkein is set (from "Edit in rhythm" jump), scroll it into view
  // and briefly highlight it, then clear the focus.
  useEffect(() => {
    if (!focusedSkein) return
    const el = sectionRefs.current.get(focusedSkein)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add(styles.skeinFocused)
      const t = setTimeout(() => {
        el.classList.remove(styles.skeinFocused)
        if (onFocusedSkeinClear) onFocusedSkeinClear()
      }, 1600)
      return () => clearTimeout(t)
    }
    if (onFocusedSkeinClear) onFocusedSkeinClear()
  }, [focusedSkein, onFocusedSkeinClear])

  function addTo(skein, title) {
    const group = threads.filter(th => (th.skein || null) === (skein || null))
    actions.addThread({ title, skein: skein || null, day: null, order: orderForNew(group) })
  }

  // Cross-skein drag resolves here: reorder within, or re-skein + reorder, in one
  // write. Order maths use the target's displayed rows (carried on its meta).
  function handleDrop({ thread, toMeta, toIndex }) {
    const targetTasks = toMeta.tasks || []
    const order = orderForMove(targetTasks, thread.id, toIndex ?? targetTasks.length)
    const targetSkein = toMeta.isLoose ? null : toMeta.skein
    const patch = { order }
    if ((thread.skein || null) !== (targetSkein || null)) patch.skein = targetSkein
    actions.patchThread(thread.id, patch)
  }

  const renderable = groups
    .map(group => {
      const all = group.tasks.filter(th => matchesQuery(th, filters.query))
      const open = all.filter(th => !th.done)
      const woven = all.filter(th => th.done)
      if (filters.topOnly) return { group, main: topOfGroup(open), fold: [] }
      if (!filters.showWoven) return { group, main: open, fold: [] }
      if (filters.collapseWoven) return { group, main: open, fold: woven }
      return { group, main: all, fold: [] }
    })
    .filter(({ main, fold }) => main.length > 0 || fold.length > 0)

  const isRhythm = (skein) => rhythmSkein === skein

  // Handle the day-picker toggle for a given day index.
  function toggleDay(skein, dayIdx) {
    const current = rhythmDays || [0, 1, 2, 3, 4, 5, 6]
    const next = current.includes(dayIdx)
      ? current.filter(d => d !== dayIdx)
      : [...current, dayIdx].sort()
    // If all 7 are selected, revert to null (all days = cleaner storage)
    const normalised = next.length === 7 ? null : next.length === 0 ? [dayIdx] : next
    onSetRhythm({ skeinName: skein, days: normalised })
  }

  // Day-picker presets
  function setDayPreset(skein, preset) {
    onSetRhythm({ skeinName: skein, days: preset })
  }

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
          <p className={styles.empty}>{filters.query ? 'No threads match your search.' : t('emptyLoom')}</p>
        )}

        {renderable.map(({ group, main, fold }) => (
          <section
            key={group.skein}
            className={styles.skein}
            ref={el => {
              if (el) sectionRefs.current.set(group.skein, el)
              else sectionRefs.current.delete(group.skein)
            }}
          >
            <header className={styles.skeinHead}>
              <h2 className={`${styles.skeinTitle} ${group.isLoose ? styles.loose : ''}`}>
                {!group.isLoose && isRhythm(group.skein) && <RhythmIcon className={styles.rhythmBadge} />}
                {group.isLoose ? t('loose') : group.skein}
              </h2>
              <span className={styles.count}>{group.tasks.length}</span>
              {!group.isLoose && onSetRhythm && (
                <button
                  type="button"
                  className={`${styles.rhythmBtn} ${isRhythm(group.skein) ? styles.rhythmOn : ''}`}
                  title={isRhythm(group.skein) ? t('unsetRhythm') : t('setAsRhythm')}
                  aria-pressed={isRhythm(group.skein)}
                  onClick={() => isRhythm(group.skein)
                    ? onSetRhythm({})  // clear
                    : onSetRhythm({ skeinName: group.skein, days: null })
                  }
                ><RhythmIcon /></button>
              )}
            </header>

            {/* Day-picker — only shown when this skein IS the rhythm */}
            {isRhythm(group.skein) && (
              <div className={styles.dayPicker}>
                <span className={styles.dayPickerLabel}>Cast on:</span>
                <span className={styles.dayPickerPresets}>
                  <button
                    type="button"
                    className={`${styles.dayPresetBtn} ${!rhythmDays ? styles.dayPresetOn : ''}`}
                    onClick={() => setDayPreset(group.skein, ALL_DAYS)}
                  >Every day</button>
                  <button
                    type="button"
                    className={`${styles.dayPresetBtn} ${JSON.stringify(rhythmDays) === JSON.stringify(WORKWEEK) ? styles.dayPresetOn : ''}`}
                    onClick={() => setDayPreset(group.skein, WORKWEEK)}
                  >Mon–Fri</button>
                  <button
                    type="button"
                    className={`${styles.dayPresetBtn} ${JSON.stringify(rhythmDays) === JSON.stringify(WEEKEND) ? styles.dayPresetOn : ''}`}
                    onClick={() => setDayPreset(group.skein, WEEKEND)}
                  >Sat–Sun</button>
                </span>
                <span className={styles.dayPickerDays}>
                  {DAY_LABELS.map((lbl, i) => {
                    const on = !rhythmDays || rhythmDays.includes(i)
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
                </span>
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
        ))}
      </div>
    </DragProvider>
  )
}
