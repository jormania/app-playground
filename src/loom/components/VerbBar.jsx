import { useLexicon } from '../lib/lexiconContext.jsx'
import styles from './VerbBar.module.css'

// A nod to the SCUMM verb interface: a sentence line above a row of chunky
// verbs, pinned to the foot of the screen. It's functional chrome — the view
// switch and the app's controls — so the tribute never gets in the mission's way.
export default function VerbBar({ view, onView, stats, mode, onOpenSettings }) {
  const { t } = useLexicon()
  const sentence = stats.total === 0
    ? t('emptyLoom')
    : `${stats.open} ${stats.open === 1 ? t('thread') : t('threads')} ${t('onLoom')}${stats.woven ? ` · ${stats.woven} ${t('woven')}` : ''}`

  const views = [
    { id: 'skeins', label: t('skeinView') },
    { id: 'loom', label: t('weekView') },
    { id: 'tapestry', label: t('tapestryView') },
  ]

  return (
    <nav className={styles.bar} aria-label="Loom controls">
      <div className={styles.sentence}>
        <span className={styles.sentenceText}>{sentence}</span>
        <span className={`${styles.mode} ${mode === 'live' ? styles.live : ''}`}>
          {mode === 'live' ? '◆ Notion' : '◇ demo'}
        </span>
      </div>
      <div className={styles.verbs}>
        {views.map(v => (
          <button
            key={v.id}
            type="button"
            className={`${styles.verb} ${view === v.id ? styles.on : ''}`}
            aria-pressed={view === v.id}
            onClick={() => onView(v.id)}
          >{v.label}</button>
        ))}
        <button type="button" className={styles.verb} onClick={onOpenSettings}>{t('guildVerb')}</button>
      </div>
    </nav>
  )
}
