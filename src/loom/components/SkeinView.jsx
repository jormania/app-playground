import { useState } from 'react'
import ThreadList from './ThreadList.jsx'
import WovenFold from './WovenFold.jsx'
import QuickAdd from './QuickAdd.jsx'
import SkeinChip from './SkeinChip.jsx'
import { DragProvider } from '../lib/dragContext.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
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

// List view: the same threads, gathered into skeins (projects/categories). Each
// skein is its own ordered stack, dyed by the Ivy-Lee heatmap. A skein-and-thread
// composer up top starts new work; every skein has its own inline adder. Search,
// the focus toggles and the group-sort all sharpen it without adding columns.
export default function SkeinView({ threads, actions, filters, onSkeinSort }) {
  const { t } = useLexicon()
  const groups = sortSkeinGroups(groupBySkein(threads), filters.skeinSort)
  const skeins = collectSkeins(threads)
  const [newSkein, setNewSkein] = useState('')

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
      let main
      let fold = []
      if (filters.topOnly) main = topOfGroup(open)
      else if (!filters.showWoven) main = open
      else if (filters.collapseWoven) { main = open; fold = woven }
      else main = all
      return { group, main, fold }
    })
    .filter(g => g.main.length > 0 || g.fold.length > 0)

  return (
    <DragProvider onDrop={handleDrop}>
      <div className={styles.view}>
        {/* Shared datalist so every SkeinChip suggests existing skeins. */}
        <datalist id="loom-skein-options">
          {skeins.map(s => <option key={s} value={s} />)}
        </datalist>

        <div className={styles.composer}>
          <input
            className={styles.skeinName}
            value={newSkein}
            placeholder={`${t('Skein')}…`}
            list="loom-skein-options"
            aria-label={`${t('Skein')} for the new ${t('thread')} (leave blank for a loose ${t('thread')})`}
            onChange={e => setNewSkein(e.target.value)}
          />
          <div className={styles.composerAdd}>
            <QuickAdd
              placeholder={newSkein.trim() ? `${t('Spin')} a ${t('thread')} into “${newSkein.trim()}”…` : t('spinLoose')}
              onAdd={title => addTo(newSkein.trim() || null, title)}
            />
          </div>
        </div>

        <div className={styles.sortBar}>
          <span className={styles.sortLabel}>{t('Skeins')} by</span>
          {SORTS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`${styles.sortBtn} ${filters.skeinSort === s.id ? styles.sortOn : ''}`}
              aria-pressed={filters.skeinSort === s.id}
              onClick={() => onSkeinSort(s.id)}
            >{s.label}</button>
          ))}
        </div>

        {renderable.length === 0 && (
          <p className={styles.empty}>{filters.query ? 'No threads match your search.' : t('emptyLoom')}</p>
        )}

        {renderable.map(({ group, main, fold }) => (
          <section key={group.skein} className={styles.skein}>
            <header className={styles.skeinHead}>
              <h2 className={`${styles.skeinTitle} ${group.isLoose ? styles.loose : ''}`}>
                {group.isLoose ? t('loose') : group.skein}
              </h2>
              <span className={styles.count}>{group.tasks.length}</span>
            </header>
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
