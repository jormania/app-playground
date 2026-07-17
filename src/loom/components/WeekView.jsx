import { useMemo, useState } from 'react'
import ThreadList from './ThreadList.jsx'
import WovenFold from './WovenFold.jsx'
import QuickAdd from './QuickAdd.jsx'
import DayMover from './DayMover.jsx'
import { DragProvider } from '../lib/dragContext.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { groupByWeek, orderForNew, orderForMove, dateKey, matchesQuery, topOfGroup } from '../lib/model.js'
import { pendingRepeats, settleForWeek } from '../lib/drafts.js'
import styles from './WeekView.module.css'

// Weekly view: the week warped across seven days, plus the distaff — a backlog
// rail of unspun (day-less) threads to pull onto a day. Same threads as List
// view; here they're grouped by day. Each column is its own heat-dyed stack, a
// drop target for cross-column drag, and honours the search + focus toggles.
export default function WeekView({
  threads, days, actions, filters, weekLabel, onPrevWeek, onNextWeek, onThisWeek, isThisWeek,
}) {
  const { t } = useLexicon()
  const { columns, backlog } = groupByWeek(threads, days)
  const todayKey = dateKey(new Date())
  const weekStartDate = days[0].date
  const weekStartKey = days[0].key
  const [castTick, setCastTick] = useState(0)
  // Repeating drafts not yet cast or dismissed for this week; castTick re-reads
  // the cast log (a localStorage side channel the linter can't see) after a
  // cast/dismiss so the offer clears.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const repeats = useMemo(() => pendingRepeats(weekStartKey), [weekStartKey, castTick])

  function addToDay(dayKey, title) {
    const group = threads.filter(th => th.day === dayKey)
    actions.addThread({ title, skein: null, day: dayKey, order: orderForNew(group) })
  }
  function addToBacklog(title) {
    const group = threads.filter(th => !th.day || !days.some(d => d.key === th.day))
    actions.addThread({ title, skein: null, day: null, order: orderForNew(group) })
  }

  // Cross-column drag resolves here: reorder within, or re-day + reorder, in one
  // write. `null` day means the distaff.
  function handleDrop({ thread, toMeta, toIndex }) {
    const targetTasks = toMeta.tasks || []
    const order = orderForMove(targetTasks, thread.id, toIndex ?? targetTasks.length)
    const targetDay = toMeta.kind === 'day' ? toMeta.key : null
    const patch = { order }
    if ((thread.day || null) !== (targetDay || null)) patch.day = targetDay
    actions.patchThread(thread.id, patch)
  }

  const dayMover = thread => (
    <DayMover thread={thread} days={days} onMove={day => actions.patchThread(thread.id, { day })} />
  )

  // Per-group display subset, honouring search + focus toggles.
  function view(tasks) {
    const all = tasks.filter(th => matchesQuery(th, filters.query))
    const open = all.filter(th => !th.done)
    const woven = all.filter(th => th.done)
    if (filters.topOnly) return { main: topOfGroup(open), fold: [] }
    if (!filters.showWoven) return { main: open, fold: [] }
    if (filters.collapseWoven) return { main: open, fold: woven }
    return { main: all, fold: [] }
  }

  function castRepeat(draft) {
    actions.castDraft(draft, weekStartDate)
    settleForWeek(draft.id, weekStartKey)
    setCastTick(n => n + 1)
  }
  function dismissRepeat(draft) {
    settleForWeek(draft.id, weekStartKey)
    setCastTick(n => n + 1)
  }

  return (
    <DragProvider onDrop={handleDrop}>
      <div className={styles.view}>
        <div className={styles.weekNav}>
          <button type="button" className={styles.navBtn} onClick={onPrevWeek} aria-label="Previous week">‹</button>
          <button
            type="button"
            className={`${styles.weekLabel} ${isThisWeek ? styles.current : ''}`}
            onClick={onThisWeek}
            title="Back to this week"
          >{weekLabel}</button>
          <button type="button" className={styles.navBtn} onClick={onNextWeek} aria-label="Next week">›</button>
        </div>

        {repeats.length > 0 && (
          <div className={styles.repeats}>
            {repeats.map(d => (
              <div key={d.id} className={styles.repeat}>
                <span className={styles.repeatText}>“{d.name}” — a repeating {t('draft')}. {t('castDraft')}?</span>
                <span className={styles.repeatBtns}>
                  <button type="button" className={styles.repeatCast} onClick={() => castRepeat(d)}>{t('castDraft')}</button>
                  <button type="button" className={styles.repeatSkip} onClick={() => dismissRepeat(d)} aria-label="Not this week">✕</button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.warp}>
          {columns.map(col => {
            const { main, fold } = view(col.tasks)
            return (
              <section key={col.key} className={`${styles.day} ${col.key === todayKey ? styles.today : ''}`}>
                <header className={styles.dayHead}>
                  <span className={styles.dayName}>{col.label}</span>
                  <span className={styles.dayNum}>{col.dayNum}</span>
                  {col.tasks.length > 0 && <span className={styles.dayCount}>{col.tasks.length}</span>}
                </header>
                <ThreadList
                  tasks={main}
                  containerId={`day:${col.key}`}
                  meta={{ kind: 'day', key: col.key, tasks: main }}
                  onReorder={(id, target) => actions.reorderWithin(col.tasks, id, target)}
                  onToggle={actions.toggleWoven}
                  onDelete={actions.removeThread}
                  onEdit={(id, title) => actions.patchThread(id, { title })}
                  renderAssign={dayMover}
                />
                <WovenFold
                  tasks={fold}
                  onToggle={actions.toggleWoven}
                  onDelete={actions.removeThread}
                  onEdit={(id, title) => actions.patchThread(id, { title })}
                />
                <div className={styles.dayAdd}>
                  <QuickAdd compact placeholder={t('addThread')} onAdd={title => addToDay(col.key, title)} />
                </div>
              </section>
            )
          })}
        </div>

        <section className={styles.distaff}>
          <header className={styles.distaffHead}>
            <h2 className={styles.distaffTitle}>{t('Distaff')}</h2>
            <span className={styles.distaffSub}>{t('distaffSub')}</span>
          </header>
          {(() => {
            const { main, fold } = view(backlog)
            return (
              <>
                <ThreadList
                  tasks={main}
                  containerId="backlog"
                  meta={{ kind: 'backlog', tasks: main }}
                  onReorder={(id, target) => actions.reorderWithin(backlog, id, target)}
                  onToggle={actions.toggleWoven}
                  onDelete={actions.removeThread}
                  onEdit={(id, title) => actions.patchThread(id, { title })}
                  renderAssign={dayMover}
                />
                <WovenFold
                  tasks={fold}
                  onToggle={actions.toggleWoven}
                  onDelete={actions.removeThread}
                  onEdit={(id, title) => actions.patchThread(id, { title })}
                />
              </>
            )
          })()}
          <div className={styles.dayAdd}>
            <QuickAdd compact placeholder={t('addUnspun')} onAdd={addToBacklog} />
          </div>
        </section>
      </div>
    </DragProvider>
  )
}
