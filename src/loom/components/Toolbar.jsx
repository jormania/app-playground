import { useLexicon } from '../lib/lexiconContext.jsx'
import styles from './Toolbar.module.css'

// A single line of focus — one search field and a few toggles that sharpen the
// two planning views without ever adding a column. Plus the two week rituals that
// don't belong on a thread row: Re-warp (carry-over) and Drafts. Hidden on the
// Tapestry, which reads across all weeks and ignores the live filters.
export default function Toolbar({ filters, setFilter, carryCount, onRewarp, onDrafts }) {
  const { t } = useLexicon()
  return (
    <div className={styles.bar}>
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

      <div className={styles.chips}>
        <button
          type="button"
          className={`${styles.chip} ${!filters.showWoven ? styles.on : ''}`}
          aria-pressed={!filters.showWoven}
          title="Hide woven threads"
          onClick={() => setFilter('showWoven', !filters.showWoven)}
        >{t('unwovenOnly')}</button>
        <button
          type="button"
          className={`${styles.chip} ${filters.topOnly ? styles.on : ''}`}
          aria-pressed={filters.topOnly}
          title="Show only the hot few in each group"
          onClick={() => setFilter('topOnly', !filters.topOnly)}
        >{t('topOnly')}</button>
        <button
          type="button"
          className={`${styles.chip} ${filters.collapseWoven ? styles.on : ''}`}
          aria-pressed={filters.collapseWoven}
          title="Fold woven threads under a per-group toggle"
          onClick={() => setFilter('collapseWoven', !filters.collapseWoven)}
        >{t('foldWoven')}</button>

        <span className={styles.spacer} />

        <button type="button" className={styles.action} onClick={onRewarp} title={t('rewarp')}>
          ⟳ {t('rewarpVerb')}{carryCount > 0 && <span className={styles.badge}>{carryCount}</span>}
        </button>
        <button type="button" className={styles.action} onClick={onDrafts} title={t('Drafts')}>
          ◈ {t('Drafts')}
        </button>
      </div>
    </div>
  )
}
