import { useLexicon } from '../lib/lexiconContext.jsx'
import { useUiStyle } from '../lib/uiStyleContext.jsx'
import { UnwovenIcon, HotFewIcon, FoldIcon, RewarpIcon, DraftsIcon } from './icons.jsx'
import styles from './Toolbar.module.css'

// The top control surface — search, the focus toggles, and the two week rituals
// (Re-warp, Drafts) — as ICON-ONLY buttons (a tooltip carries the localized
// label) so the whole thing holds a single row on every screen and interface
// style, coordinated with the bottom bar. Hidden on the Tapestry, which ignores
// the live filters.
//
// A tooltip needs hover, which a touch screen never fires — so once a filter is
// toggled, its icon alone can't say WHICH one is on. A slim caption line under
// the row names whichever toggles are active (nothing shown when none are), so
// the state stays legible without hover and without bringing text chips back.
export default function Toolbar({ filters, setFilter, carryCount, onRewarp, onDrafts }) {
  const { t } = useLexicon()
  const { style } = useUiStyle()

  const toggles = [
    { key: 'unwoven', Icon: UnwovenIcon, label: t('unwovenOnly'), on: !filters.showWoven, onClick: () => setFilter('showWoven', !filters.showWoven) },
    { key: 'top', Icon: HotFewIcon, label: t('topOnly'), on: filters.topOnly, onClick: () => setFilter('topOnly', !filters.topOnly) },
    { key: 'fold', Icon: FoldIcon, label: t('foldWoven'), on: filters.collapseWoven, onClick: () => setFilter('collapseWoven', !filters.collapseWoven) },
  ]
  const activeLabels = toggles.filter(tg => tg.on).map(tg => tg.label)

  return (
    <div className={styles.wrap}>
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

        <div className={styles.group}>
          {toggles.map(tg => (
            <button
              key={tg.key}
              type="button"
              className={`${styles.iconBtn} ${tg.on ? styles.on : ''}`}
              aria-pressed={tg.on}
              aria-label={tg.label}
              title={tg.label}
              onClick={tg.onClick}
            ><tg.Icon /></button>
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.iconBtn} aria-label={t('rewarp')} title={t('rewarp')} onClick={onRewarp}>
            <RewarpIcon />
            {carryCount > 0 && <span className={styles.badge}>{carryCount}</span>}
          </button>
          <button type="button" className={styles.iconBtn} aria-label={t('Drafts')} title={t('Drafts')} onClick={onDrafts}>
            <DraftsIcon />
          </button>
        </div>
      </div>

      {activeLabels.length > 0 && (
        <p className={styles.hint} title={activeLabels.join(' · ')}>{activeLabels.join(' · ')}</p>
      )}
    </div>
  )
}
