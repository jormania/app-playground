import { IconButton } from '../../ds'
import { IconArrowUp, IconArrowDown } from './icons'
import styles from './AppTile.module.css'

// installed: true when the browser has genuinely confirmed this app is
// installed — anything else (false, null, unsupported browser) is treated as
// "unknown", not "not installed". A confirmed real install from a Chromium
// user still reads as false sometimes (Chrome throttles
// getInstalledRelatedApps() to prevent it being used to fingerprint a
// device's installed apps), so a negative result here can't be trusted
// enough to show as an error — see CABINET.md.
//
// editing: while reordering, the stretched link is dropped (a tap should
// move a tile, not launch it) and the arrow is swapped for up/down controls.
export function AppTile({ app, installed, editing, onMoveUp, onMoveDown, disableUp, disableDown }) {
  const href = `/${app.file}`

  return (
    <article className={styles.tile}>
      {/* Stretched-link pattern: makes the whole card tappable (easier on
          mobile than a small button) while staying a real <a> for keyboard/
          screen-reader users. Sits behind everything in z-order; only the
          twistie below is raised above it so opening "More" doesn't also
          navigate away. Dropped entirely while reordering. */}
      {!editing && (
        <a
          className={styles.stretchedLink}
          href={href}
          aria-label={`${installed ? 'Launch' : 'Open'} ${app.title}`}
        />
      )}

      <div className={styles.top}>
        <div className={styles.icon} style={{ background: app.iconBg || 'var(--color-glow)' }}>
          {app.emoji}
        </div>
        <div className={styles.meta}>
          <div className={styles.title}>{app.title}</div>
          <div className={styles.subtitle}>{app.subtitle}</div>
        </div>
        {editing ? (
          <div className={styles.reorder}>
            <IconButton size="sm" aria-label="Move up" disabled={disableUp} onClick={onMoveUp}>
              <IconArrowUp />
            </IconButton>
            <IconButton size="sm" aria-label="Move down" disabled={disableDown} onClick={onMoveDown}>
              <IconArrowDown />
            </IconButton>
          </div>
        ) : (
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        )}
      </div>

      {!editing && app.description && (
        <details className={styles.details}>
          <summary>More</summary>
          <p className={styles.description}>{app.description}</p>
        </details>
      )}
    </article>
  )
}
