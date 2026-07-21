import { useCallback, useMemo, useRef, useState } from 'react'
import ThreadList from './ThreadList.jsx'
import WovenFold from './WovenFold.jsx'
import QuickAdd from './QuickAdd.jsx'
import DayMover from './DayMover.jsx'
import { DragProvider } from '../lib/dragContext.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { useUiStyle } from '../lib/uiStyleContext.jsx'
import { RhythmIcon } from './icons.jsx'
import { groupByWeek, orderForNew, orderForMove, dateKey, matchesQuery, splitRhythmThreads } from '../lib/model.js'
import { pendingRepeats, settleForWeek } from '../lib/drafts.js'
import { pendingRhythms, settleRhythmForWeek } from '../lib/rhythm.js'
import styles from './WeekView.module.css'

// Weekly view: the week warped across seven days, plus the distaff — a backlog
// rail of unspun (day-less) threads to pull onto a day. Same threads as Skeins
// view; here they're grouped by day. Each column is its own heat-dyed stack, a
// drop target for cross-column drag, and honours the search + focus toggles.
// Rhythm threads (from any flagged skein) sit in a tinted block at the top of
// each day column. The distaff never shows rhythm threads — they belong to the
// cast, not the backlog.
export default function WeekView({
  threads, days, actions, filters, weekLabel, onPrevWeek, onNextWeek, onThisWeek, isThisWeek,
  rhythms, rhythmSkeinNames, onEditInRhythm,
}) {
  const { t } = useLexicon()
  const { style } = useUiStyle()
  const { columns, backlog } = groupByWeek(threads, days)
  const todayKey = dateKey(new Date())
  const weekStartDate = days[0].date
  const weekStartKey = days[0].key
  const [castTick, setCastTick] = useState(0)
  const [longPress, setLongPress] = useState(null)
  const lpTimer = useRef(null)
  const lpSkein = useRef(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const repeats = useMemo(() => pendingRepeats(weekStartKey), [weekStartKey, castTick])

  // Rhythm banner: returns unsettled rhythms for this week, or [] if all settled.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pendingRhythmsList = useMemo(() => pendingRhythms(weekStartKey), [weekStartKey, castTick])
  const hasPendingRhythm = pendingRhythmsList.length > 0

  // Total canonical thread count across all pending rhythms (for banner text).
  const rhythmCount = useMemo(() => {
    if (!hasPendingRhythm || !rhythmSkeinNames.size) return 0
    const seen = new Set()
    for (const th of threads) {
      if (rhythmSkeinNames.has(th.skein) && !th.done) {
        const key = `${th.skein}:::${th.title}`
        if (!seen.has(key)) seen.add(key)
      }
    }
    return seen.size
  }, [threads, rhythmSkeinNames, hasPendingRhythm])

  function addToDay(dayKey, title) {
    const group = threads.filter(th => th.day === dayKey)
    actions.addThread({ title, skein: null, day: dayKey, order: orderForNew(group) })
  }

  // Long-press handlers for rhythm threads — long-press (400ms) opens the
  // "Edit in rhythm" context menu anchored to the pointer position.
  const startLongPress = useCallback((e, skeinName) => {
    if (e.button > 0) return
    lpSkein.current = skeinName
    const { clientX: x, clientY: y } = e
    lpTimer.current = setTimeout(() => setLongPress({ x, y }), 400)
  }, [setLongPress])
  const cancelLongPress = useCallback(() => clearTimeout(lpTimer.current), [])
  const commitEditInRhythm = useCallback(() => {
    setLongPress(null)
    if (onEditInRhythm && lpSkein.current) onEditInRhythm(lpSkein.current)
  }, [onEditInRhythm, setLongPress])

  function addToBacklog(title) {
    const group = threads.filter(th => !th.day || !days.some(d => d.key === th.day))
    actions.addThread({ title, skein: null, day: null, order: orderForNew(group) })
  }

  function handleDrop({ thread, toMeta, toIndex }) {
    const targetTasks = toMeta.tasks || []
    const order = orderForMove(targetTasks, thread.id, toIndex ?? targetTasks.length)
    const targetDay = toMeta.kind === 'day' ? toMeta.key : null
    const patch = { order }
    if ((thread.day || null) !== (targetDay || null)) patch.day = targetDay
    actions.patchThread(thread.id, patch)
  }

  // A DAILY rhythm thread (days = null, every day) has nowhere meaningful to
  // move to — it's already on every day of the week — so its day-letter chip
  // and move popover are just noise. A rhythm on a partial pattern (M–F, custom
  // days) still gets the mover, since moving it off-pattern is a real action.
  const dayMover = thread => {
    const entry = rhythmSkeinNames.has(thread.skein) ? rhythms?.find(r => r.skeinName === thread.skein) : null
    if (entry && entry.days == null) return null
    return <DayMover thread={thread} days={days} onMove={day => actions.patchThread(thread.id, { day })} />
  }

  // Per-group display subset, honouring search + focus toggles.
  // "Rhythm order" sort: within the rhythm block, sort by skein then by order
  // (so all Body threads come first, ordered, then all Focus threads, etc.).
  function view(tasks, isRhythmBlock = false) {
    const all = tasks.filter(th => matchesQuery(th, filters.query))
    const open = all.filter(th => !th.done)
    const woven = all.filter(th => th.done)
    let main = !filters.showWoven ? open : filters.collapseWoven ? open : all
    const fold = !filters.showWoven ? [] : filters.collapseWoven ? woven : []
    if (isRhythmBlock && filters.rhythmSort) {
      // Sort rhythm block by skein-canonical order: group by skein, maintain
      // the within-skein order from the Skeins view (thread.order).
      main = [...main].sort((a, b) => {
        if (a.skein !== b.skein) return (a.skein || '').localeCompare(b.skein || '')
        return (a.order ?? 0) - (b.order ?? 0)
      })
    }
    return { main, fold }
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

  function castRhythm() {
    actions.castRhythm(weekStartDate)
    settleRhythmForWeek(weekStartKey)
    setCastTick(n => n + 1)
  }
  function dismissRhythm() {
    settleRhythmForWeek(weekStartKey)
    setCastTick(n => n + 1)
  }

  const multiRhythm = (rhythms?.length ?? 0) > 1

  return (
    <DragProvider onDrop={handleDrop}>
      <div className={styles.view}>
        <div className={`${styles.weekNav} ${styles[`nav_${style}`]}`}>
          <button type="button" className={styles.navBtn} onClick={onPrevWeek} aria-label="Previous warp">‹</button>
          <button
            type="button"
            className={`${styles.weekLabel} ${isThisWeek ? styles.current : ''}`}
            onClick={onThisWeek}
            title="Back to this warp"
          >{weekLabel}</button>
          <button type="button" className={styles.navBtn} onClick={onNextWeek} aria-label="Next warp">›</button>
        </div>

        {/* Rhythm cast offer */}
        {hasPendingRhythm && rhythmCount > 0 && (
          <div className={styles.rhythmOffer}>
            <span className={styles.rhythmOfferIcon}><RhythmIcon /></span>
            <span className={styles.rhythmOfferText}>
              {t(multiRhythm ? 'rhythmsBanner' : 'rhythmBanner')}{' '}
              <span className={styles.rhythmOfferCount}>{rhythmCount} {rhythmCount === 1 ? t('thread') : t('threads')}</span>
            </span>
            <span className={styles.repeatBtns}>
              <button type="button" className={styles.repeatCast} onClick={castRhythm}>{t('castRhythm')}</button>
              <button type="button" className={styles.repeatSkip} onClick={dismissRhythm} aria-label="Not this warp">✕</button>
            </span>
          </div>
        )}

        {repeats.length > 0 && (
          <div className={styles.repeats}>
            {repeats.map(d => (
              <div key={d.id} className={styles.repeat}>
                <span className={styles.repeatText}>"{d.name}" — a repeating {t('draft')}. {t('castDraft')}?</span>
                <span className={styles.repeatBtns}>
                  <button type="button" className={styles.repeatCast} onClick={() => castRepeat(d)}>{t('castDraft')}</button>
                  <button type="button" className={styles.repeatSkip} onClick={() => dismissRepeat(d)} aria-label="Not this warp">✕</button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.warp}>
          {columns.map(col => {
            // Split rhythm threads (from any rhythm skein) off the RAW day list
            // first, then apply the show/fold view to each half separately. Doing
            // it in the other order (view() first, split second) let a day's
            // rhythm block vanish — fold and all — the moment every rhythm thread
            // on it was woven: view() had already routed them into the outer
            // fold bucket before the split ever saw them, so the rhythm-only
            // view() call downstream started from an empty array.
            const { rhythm: rawRhythm, rest: rawRest } = splitRhythmThreads(col.tasks, rhythmSkeinNames)
            const { main: rhythmMain, fold: rhythmFold } = view(rawRhythm, true)
            const { main: rest, fold } = view(rawRest)
            const hasRhythm = rhythmMain.length > 0 || rhythmFold.length > 0

            // The first rhythm skein present in this column (for "Edit in rhythm" menu).
            const firstRhythmSkein = hasRhythm ? rawRhythm[0]?.skein : null

            return (
              <section key={col.key} className={`${styles.day} ${col.key === todayKey ? styles.today : ''}`}>
                <header className={styles.dayHead}>
                  <span className={styles.dayName}>{col.label}</span>
                  <span className={styles.dayNum}>{col.dayNum}</span>
                  {col.tasks.length > 0 && <span className={styles.dayCount}>{col.tasks.length}</span>}
                </header>

                {/* Rhythm block — tinted, long-pressable for "Edit in rhythm". */}
                {hasRhythm && (
                  <div
                    className={styles.rhythmBlock}
                    onPointerDown={e => startLongPress(e, firstRhythmSkein)}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerMove={cancelLongPress}
                  >
                    <ThreadList
                      tasks={rhythmMain}
                      containerId={`day-rhythm:${col.key}`}
                      meta={{ kind: 'day', key: col.key, tasks: rhythmMain }}
                      onReorder={(id, target) => actions.reorderWithin(col.tasks, id, target)}
                      onToggle={actions.toggleWoven}
                      onDelete={actions.removeThread}
                      onEdit={(id, title) => actions.patchThread(id, { title })}
                      renderAssign={dayMover}
                      rhythmSkeins={rhythmSkeinNames}
                    />
                    {rhythmFold.length > 0 && (
                      <WovenFold
                        tasks={rhythmFold}
                        onToggle={actions.toggleWoven}
                        onDelete={actions.removeThread}
                        onEdit={(id, title) => actions.patchThread(id, { title })}
                      />
                    )}
                  </div>
                )}

                {/* Non-rhythm threads. */}
                <ThreadList
                  tasks={rest}
                  containerId={`day:${col.key}`}
                  meta={{ kind: 'day', key: col.key, tasks: rest }}
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

        {/* Distaff — rhythm threads are excluded; they belong to the cast. */}
        <section className={styles.distaff}>
          <header className={styles.distaffHead}>
            <h2 className={styles.distaffTitle}>{t('Distaff')}</h2>
            <span className={styles.distaffSub}>{t('distaffSub')}</span>
          </header>
          {(() => {
            const nonRhythmBacklog = backlog.filter(th => !rhythmSkeinNames.has(th.skein))
            const { main, fold } = view(nonRhythmBacklog)
            return (
              <>
                <ThreadList
                  tasks={main}
                  containerId="backlog"
                  meta={{ kind: 'backlog', tasks: main }}
                  onReorder={(id, target) => actions.reorderWithin(nonRhythmBacklog, id, target)}
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

      {/* Long-press context menu — "Edit in rhythm" */}
      {longPress && (
        <div
          className={styles.lpMenu}
          style={{ top: longPress.y, left: longPress.x }}
          role="menu"
        >
          <button type="button" className={styles.lpItem} role="menuitem" onClick={commitEditInRhythm}>
            <RhythmIcon />
            Edit in rhythm
          </button>
          <button type="button" className={styles.lpDismiss} onClick={() => setLongPress(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
    </DragProvider>
  )
}
