import { IconButton } from '../../ds'
import { IconArrowUp, IconArrowDown } from './icons'
import { canInstallPwaHere, chromeIntentUrl } from '../lib/browserSupport'
import { recordOpened } from '../lib/storage'
import { formatRelativeTime } from '../lib/relativeTime'
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
//
// Any non-`true` install status shows "Install" rather than "Launch" — same
// "never assert a negative" stance as the aria-label always used. On Android,
// beforeinstallprompt can only be captured by the page that owns the
// manifest, so Cabinet can't trigger a real install itself; the best it can
// do is make sure the tap lands in a browser that can install at all. Edge
// for Android (unlike its desktop build) doesn't support installing a PWA,
// so if that's the phone's default browser, route the tap through Chrome
// instead of silently opening a page the visitor can't act on.
//
// kind: "static" apps (the hand-authored legacy HTML ones, shown only via
// the Cabinet's "Legacy apps" toggle) have no manifest and nothing to
// install — they just open as a plain page, so none of the above applies.
export function AppTile({ app, installed, isNew, lastOpenedAt, editing, onMoveUp, onMoveDown, disableUp, disableDown }) {
  const isStatic = app.kind === 'static'
  const path = `/${app.file}`
  const needsChromeRedirect = !isStatic && !installed && !canInstallPwaHere()
  const href = needsChromeRedirect ? chromeIntentUrl(window.location.origin + path) : path
  const actionLabel = isStatic ? 'Open' : installed ? 'Launch' : 'Install'

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
          onClick={() => recordOpened(app.file)}
          aria-label={`${actionLabel} ${app.title}${needsChromeRedirect ? ' (opens in Chrome)' : ''}`}
        />
      )}

      <div className={styles.top}>
        <div className={styles.icon} style={{ background: app.iconBg || 'var(--color-glow)' }}>
          {app.emoji}
        </div>
        <div className={styles.meta}>
          <div className={styles.titleRow}>
            <div className={styles.title}>{app.title}</div>
            {isNew && <span className={styles.badge}>New</span>}
          </div>
          <div className={styles.subtitle}>{app.subtitle}</div>
          {!editing && lastOpenedAt && (
            <div className={styles.lastOpened}>opened {formatRelativeTime(lastOpenedAt)}</div>
          )}
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
          <span className={styles.action} aria-hidden="true">
            <span className={styles.actionLabel}>{actionLabel}</span>
            <span className={styles.arrow}>{isStatic || installed ? '→' : '⤓'}</span>
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
