import styles from './VerbBar.module.css'

// A nod to the SCUMM verb interface: a sentence line above a row of chunky
// verbs, pinned to the foot of the screen. It's functional chrome — the view
// toggle and the app's controls — so the tribute never gets in the mission's way.
export default function VerbBar({ view, onView, showWoven, onToggleWoven, stats, mode, onOpenSettings }) {
  const sentence = stats.total === 0
    ? 'The loom stands empty.'
    : `${stats.open} thread${stats.open === 1 ? '' : 's'} on the loom${stats.woven ? ` · ${stats.woven} woven` : ''}`

  return (
    <nav className={styles.bar} aria-label="Loom controls">
      <div className={styles.sentence}>
        <span className={styles.sentenceText}>{sentence}</span>
        <span className={`${styles.mode} ${mode === 'live' ? styles.live : ''}`}>
          {mode === 'live' ? '◆ Notion' : '◇ demo'}
        </span>
      </div>
      <div className={styles.verbs}>
        <button
          type="button"
          className={`${styles.verb} ${view === 'skeins' ? styles.on : ''}`}
          aria-pressed={view === 'skeins'}
          onClick={() => onView('skeins')}
        >Skeins</button>
        <button
          type="button"
          className={`${styles.verb} ${view === 'loom' ? styles.on : ''}`}
          aria-pressed={view === 'loom'}
          onClick={() => onView('loom')}
        >The Week</button>
        <button
          type="button"
          className={`${styles.verb} ${showWoven ? styles.on : ''}`}
          aria-pressed={showWoven}
          onClick={onToggleWoven}
        >Woven</button>
        <button type="button" className={styles.verb} onClick={onOpenSettings}>Guild</button>
      </div>
    </nav>
  )
}
