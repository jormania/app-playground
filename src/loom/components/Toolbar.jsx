import { useLexicon } from '../lib/lexiconContext.jsx'
import { useUiStyle } from '../lib/uiStyleContext.jsx'
import styles from './Toolbar.module.css'

// The top control surface — search, the focus toggles, and the two week rituals
// (Re-warp, Drafts). It takes the SAME interface style as the bottom bar so the
// two always read as a coordinated pair: a slim frosted row, floating pills, or a
// flat glyph+label strip. Hidden on the Tapestry, which ignores the live filters.
export default function Toolbar({ filters, setFilter, carryCount, onRewarp, onDrafts }) {
  const { t } = useLexicon()
  const { style } = useUiStyle()

  // Focus toggles carry a glyph that only shows in the "tabs" style (matching the
  // bottom icon tabs); in row/pill they read as plain chips.
  const toggles = [
    { key: 'unwoven', glyph: '◑', label: t('unwovenOnly'), on: !filters.showWoven, title: 'Hide woven threads', onClick: () => setFilter('showWoven', !filters.showWoven) },
    { key: 'top', glyph: '▲', label: t('topOnly'), on: filters.topOnly, title: 'Show only the hot few in each group', onClick: () => setFilter('topOnly', !filters.topOnly) },
    { key: 'fold', glyph: '▾', label: t('foldWoven'), on: filters.collapseWoven, title: 'Fold woven threads under a per-group toggle', onClick: () => setFilter('collapseWoven', !filters.collapseWoven) },
  ]

  return (
    <div className={`${styles.bar} ${styles[style]}`}>
      <div className={styles.searchWrap}>
        <span className={styles.glass} aria-hidden="true">⌕</span>
        <input
          className={styles.search}
          type="search"
          value={filters.query}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          onChange={e => setFilter('query', e.target.value)}
        />
        {filters.query && (
          <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => setFilter('query', '')}>✕</button>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.group}>
          {toggles.map(tg => (
            <button
              key={tg.key}
              type="button"
              className={`${styles.chip} ${tg.on ? styles.on : ''}`}
              aria-pressed={tg.on}
              title={tg.title}
              onClick={tg.onClick}
            >
              <span className={styles.tabGlyph} aria-hidden="true">{tg.glyph}</span>
              <span className={styles.label}>{tg.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={onRewarp} title={t('rewarp')}>
            <span className={styles.actionGlyph} aria-hidden="true">⟳</span>
            <span className={styles.label}>{t('rewarpVerb')}</span>
            {carryCount > 0 && <span className={styles.badge}>{carryCount}</span>}
          </button>
          <button type="button" className={styles.action} onClick={onDrafts} title={t('Drafts')}>
            <span className={styles.actionGlyph} aria-hidden="true">◈</span>
            <span className={styles.label}>{t('Drafts')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
