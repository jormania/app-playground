import { useState } from 'react'
import ThreadList from './ThreadList.jsx'
import QuickAdd from './QuickAdd.jsx'
import SkeinChip from './SkeinChip.jsx'
import { groupBySkein, collectSkeins, orderForNew } from '../lib/model.js'
import styles from './SkeinView.module.css'

// List view: the same threads, gathered into skeins (projects/categories). Each
// skein is its own ordered stack, dyed by the Ivy-Lee heatmap. A skein-and-thread
// composer up top starts new work; every skein has its own inline adder.
export default function SkeinView({ threads, actions }) {
  const groups = groupBySkein(threads)
  const skeins = collectSkeins(threads)
  const [newSkein, setNewSkein] = useState('')

  function addTo(skein, title) {
    const group = threads.filter(t => (t.skein || null) === (skein || null))
    actions.addThread({ title, skein: skein || null, day: null, order: orderForNew(group) })
  }

  return (
    <div className={styles.view}>
      {/* Shared datalist so every SkeinChip suggests existing skeins. */}
      <datalist id="loom-skein-options">
        {skeins.map(s => <option key={s} value={s} />)}
      </datalist>

      <div className={styles.composer}>
        <input
          className={styles.skeinName}
          value={newSkein}
          placeholder="Skein…"
          list="loom-skein-options"
          aria-label="Skein for the new thread (leave blank for a loose thread)"
          onChange={e => setNewSkein(e.target.value)}
        />
        <div className={styles.composerAdd}>
          <QuickAdd
            placeholder={newSkein.trim() ? `Spin a thread into “${newSkein.trim()}”…` : 'Spin a loose thread…'}
            onAdd={title => addTo(newSkein.trim() || null, title)}
          />
        </div>
      </div>

      {groups.length === 0 && (
        <p className={styles.empty}>The loom stands bare. Spin a thread above to begin.</p>
      )}

      {groups.map(group => (
        <section key={group.skein} className={styles.skein}>
          <header className={styles.skeinHead}>
            <h2 className={`${styles.skeinTitle} ${group.isLoose ? styles.loose : ''}`}>{group.skein}</h2>
            <span className={styles.count}>{group.tasks.length}</span>
          </header>
          <ThreadList
            tasks={group.tasks}
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
          <div className={styles.skeinAdd}>
            <QuickAdd
              compact
              placeholder="＋ thread"
              onAdd={title => addTo(group.isLoose ? null : group.skein, title)}
            />
          </div>
        </section>
      ))}
    </div>
  )
}
