import { useLexicon } from '../lib/lexiconContext.jsx'
import { useUiStyle } from '../lib/uiStyleContext.jsx'
import styles from './VerbBar.module.css'

// The bottom navigation — a nod to the SCUMM verb interface, but slimmed to one
// of three user-chosen shapes (Settings → Navigation bar): a slim frosted row, a
// floating pill, or an icon tab bar. Every shape carries the same view switch and
// Settings access; the demo/Notion state rides along as a small dot.
const ICONS = { skeins: '❋', loom: '▦', tapestry: '▤', guild: '⚙' }

export default function VerbBar({ view, onView, mode, onOpenSettings }) {
  const { t } = useLexicon()
  const { style } = useUiStyle()

  const views = [
    { id: 'skeins', label: t('skeinView') },
    { id: 'loom', label: t('weekView') },
    { id: 'tapestry', label: t('tapestryView') },
  ]

  const modeDot = (
    <span
      className={`${styles.modeDot} ${mode === 'live' ? styles.live : ''}`}
      title={mode === 'live' ? 'Bound to Notion' : 'Demo — on this device'}
      aria-label={mode === 'live' ? 'Connected to Notion' : 'Demo mode'}
      role="img"
    />
  )

  // ── Icon tabs ──
  if (style === 'tabs') {
    const tabs = [...views, { id: 'guild', label: t('guildVerb') }]
    return (
      <nav className={`${styles.bar} ${styles.tabsBar}`} aria-label="Loom navigation">
        {tabs.map(v => {
          const active = v.id !== 'guild' && view === v.id
          return (
            <button
              key={v.id}
              type="button"
              className={`${styles.tab} ${active ? styles.tabOn : ''}`}
              aria-pressed={v.id === 'guild' ? undefined : active}
              onClick={() => (v.id === 'guild' ? onOpenSettings() : onView(v.id))}
            >
              <span className={styles.tabIcon} aria-hidden="true">{ICONS[v.id]}</span>
              <span className={styles.tabLabel}>{v.label}</span>
            </button>
          )
        })}
        <span className={styles.tabsMode}>{modeDot}</span>
      </nav>
    )
  }

  // ── Shared segmented switch + gear (pill + row) ──
  const seg = (
    <div className={styles.seg} role="tablist" aria-label="View">
      {views.map(v => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={view === v.id}
          className={`${styles.segBtn} ${view === v.id ? styles.segOn : ''}`}
          onClick={() => onView(v.id)}
        >{v.label}</button>
      ))}
    </div>
  )
  const gear = (
    <button type="button" className={styles.gear} onClick={onOpenSettings} aria-label={t('Guild')} title={t('Guild')}>⚙</button>
  )

  // ── Floating pill ──
  if (style === 'pill') {
    return (
      <nav className={`${styles.bar} ${styles.pillWrap}`} aria-label="Loom navigation">
        <div className={styles.pill}>
          {seg}
          <span className={styles.pillDivider} aria-hidden="true" />
          {gear}
          {modeDot}
        </div>
      </nav>
    )
  }

  // ── Slim row (default) ──
  return (
    <nav className={`${styles.bar} ${styles.rowBar}`} aria-label="Loom navigation">
      {seg}
      <div className={styles.rowRight}>
        {modeDot}
        {gear}
      </div>
    </nav>
  )
}
