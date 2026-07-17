import ThreadList from './ThreadList.jsx'
import QuickAdd from './QuickAdd.jsx'
import DayMover from './DayMover.jsx'
import { groupByWeek, orderForNew, dateKey } from '../lib/model.js'
import styles from './WeekView.module.css'

// Weekly view: the week warped across seven days, plus the distaff — a backlog
// rail of unspun (day-less) threads to pull onto a day. Same threads as List
// view; here they're grouped by day. Each column is its own heat-dyed stack.
export default function WeekView({ threads, days, actions, weekLabel, onPrevWeek, onNextWeek, onThisWeek, isThisWeek }) {
  const { columns, backlog } = groupByWeek(threads, days)
  const todayKey = dateKey(new Date())

  function addToDay(dayKey, title) {
    const group = threads.filter(t => t.day === dayKey)
    actions.addThread({ title, skein: null, day: dayKey, order: orderForNew(group) })
  }
  function addToBacklog(title) {
    const group = threads.filter(t => !t.day || !days.some(d => d.key === t.day))
    actions.addThread({ title, skein: null, day: null, order: orderForNew(group) })
  }

  const dayMover = thread => (
    <DayMover thread={thread} days={days} onMove={day => actions.patchThread(thread.id, { day })} />
  )

  return (
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

      <div className={styles.warp}>
        {columns.map(col => (
          <section key={col.key} className={`${styles.day} ${col.key === todayKey ? styles.today : ''}`}>
            <header className={styles.dayHead}>
              <span className={styles.dayName}>{col.label}</span>
              <span className={styles.dayNum}>{col.dayNum}</span>
              {col.tasks.length > 0 && <span className={styles.dayCount}>{col.tasks.length}</span>}
            </header>
            <ThreadList
              tasks={col.tasks}
              onReorder={(id, target) => actions.reorderWithin(col.tasks, id, target)}
              onToggle={actions.toggleWoven}
              onDelete={actions.removeThread}
              onEdit={(id, title) => actions.patchThread(id, { title })}
              renderAssign={dayMover}
            />
            <div className={styles.dayAdd}>
              <QuickAdd compact placeholder="＋ thread" onAdd={title => addToDay(col.key, title)} />
            </div>
          </section>
        ))}
      </div>

      <section className={styles.distaff}>
        <header className={styles.distaffHead}>
          <h2 className={styles.distaffTitle}>The distaff</h2>
          <span className={styles.distaffSub}>unspun threads — pull one onto a day</span>
        </header>
        <ThreadList
          tasks={backlog}
          onReorder={(id, target) => actions.reorderWithin(backlog, id, target)}
          onToggle={actions.toggleWoven}
          onDelete={actions.removeThread}
          onEdit={(id, title) => actions.patchThread(id, { title })}
          renderAssign={dayMover}
        />
        <div className={styles.dayAdd}>
          <QuickAdd compact placeholder="＋ unspun thread" onAdd={addToBacklog} />
        </div>
      </section>
    </div>
  )
}
