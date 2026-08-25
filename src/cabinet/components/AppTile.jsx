import { useCallback, useState } from 'react'
import { IconButton, Modal } from '../../ds'
import { IconArrowUp, IconArrowDown, IconMore } from './icons'
import { canInstallPwaHere, chromeIntentUrl, isAndroid, isIos, pwaLaunchIntentUrl } from '../lib/browserSupport'
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
// move a tile, not launch it) and the corner "details" button is swapped for
// up/down controls.
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
// kind: "static" apps (the hand-authored legacy HTML ones) have no manifest
// and nothing to install — they just open as a plain page, so none of the
// above applies.
//
// On Android, a react-vite tap goes through pwaLaunchIntentUrl rather than a
// plain relative href — see the comment on that function in
// browserSupport.js for why a same-origin <a> can't hand off to an installed
// WebAPK on its own.
//
// Unconditionally — regardless of `installed` status, per CABINET.md. That
// intent is an OS-level ACTION_VIEW, so Android resolves it against
// everything that claims the URL; if no WebAPK does, S.browser_fallback_url
// just reopens the plain page, i.e. today's behaviour, so there's no real
// downside to trying it even when install detection says false or unknown.
// A prior revision gated this on installed === true instead, reasoning that
// a false negative was rare enough that a guaranteed "Open with" chooser
// (when nothing is actually installed) cost more than it was worth. In
// practice that gate meant a genuinely-installed app whose flag hadn't been
// set yet — e.g. added to the home screen but never opened standalone even
// once, since the flag itself is only set from inside a standalone launch —
// could never get that first standalone launch from the Cabinet at all: the
// tap just reopened a browser tab, every time, with no way to break the
// cycle. Reverted back to unconditional so a real install always gets found.
//
// Everything that isn't "icon + name + tap to launch" — description, last-
// opened stats, the QR code, the New badge's word — lives behind the corner
// "details" button instead of on the tile itself, so a screenful of tiles
// stays a grid of icons rather than a list of cards.
export function AppTile({ app, installed, isNew, openStats, editing, onMoveUp, onMoveDown, disableUp, disableDown }) {
  const isStatic = app.kind === 'static'
  const path = `/${app.file}`
  const needsChromeRedirect = !isStatic && !installed && !canInstallPwaHere()
  const href = needsChromeRedirect
    ? chromeIntentUrl(window.location.origin + path)
    : !isStatic && isAndroid()
      ? pwaLaunchIntentUrl(window.location.origin + path)
      : path
  // "Install" is only ever offered where a tap can actually lead to one. On
  // iOS nothing can (see isIos), so an uninstalled app there reads "Open" —
  // which is exactly what the tap does. An app already confirmed installed
  // still says "Launch" on iOS, since that flag comes from the app itself
  // having run standalone, which is real proof it was added to the home
  // screen.
  const canOfferInstall = !isStatic && !isIos()
  const actionLabel = installed ? 'Launch' : canOfferInstall ? 'Install' : 'Open'

  // Detail sheet: rendered lazily — the QR canvas only exists in the DOM once
  // the Modal actually opens (it returns null while closed).
  //
  // Drawn from a *callback ref*, not an effect keyed on `detailOpen`. Modal
  // mounts in two passes: on the commit where `open` flips true its own
  // isMounted is still false, so it returns null and the canvas isn't in the
  // tree yet — an effect keyed on detailOpen fires on exactly that commit,
  // sees a null ref, and never re-runs once the portal lands on the following
  // one. (Modal documents the same two-pass trap for its focus effect.) A
  // callback ref instead fires when the node genuinely attaches, whichever
  // commit that turns out to be.
  //
  // The `qrcode` library is ~23KB gzipped — dead weight on every Cabinet
  // load when the vast majority of taps just launch an app and never open a
  // detail sheet. Dynamically imported here so it's fetched only once a
  // sheet is actually opened, off Cabinet's critical startup path entirely.
  const [detailOpen, setDetailOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState(null)
  const drawQr = useCallback((canvas) => {
    if (!canvas) return
    // Ref callbacks must not return a value (React 19 reads a return as a
    // cleanup function), so the promise is deliberately not returned.
    import('../../shared/qrCode').then(({ appQrUrl, renderAppQr }) => {
      setQrUrl(appQrUrl(app.file))
      return renderAppQr(canvas, app.file)
    })
  }, [app.file])

  return (
    <article className={styles.tile}>
      {/* Stretched-link pattern: makes the whole tile tappable (easier on
          mobile than a small button) while staying a real <a> for keyboard/
          screen-reader users. Sits behind everything in z-order; only the
          corner button below is raised above it so opening details doesn't
          also navigate away. Dropped entirely while reordering. */}
      {!editing && (
        <a
          className={styles.stretchedLink}
          href={href}
          onClick={() => recordOpened(app.file)}
          aria-label={`${actionLabel} ${app.title}${needsChromeRedirect ? ' (opens in Chrome)' : ''}`}
        />
      )}

      <div className={styles.icon} style={{ background: app.iconBg || 'var(--color-glow)' }}>
        {app.emoji}
        {isNew && <span className={styles.newDot} aria-hidden="true" />}
      </div>
      <div className={styles.title}>{app.title}</div>

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
        // Raised above the stretched link (see .moreButton) so tapping it
        // opens the detail sheet instead of also navigating.
        <IconButton
          size="sm"
          className={styles.moreButton}
          aria-label={`Details for ${app.title}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDetailOpen(true) }}
        >
          <IconMore />
        </IconButton>
      )}

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={app.title}>
        <div className={styles.detailHead}>
          <div className={styles.detailIcon} style={{ background: app.iconBg || 'var(--color-glow)' }}>
            {app.emoji}
          </div>
          <div className={styles.detailMeta}>
            <div className={styles.detailTitleRow}>
              <div className={styles.detailTitle}>{app.title}</div>
              {isNew && <span className={styles.badge}>New</span>}
            </div>
            {app.subtitle && <div className={styles.detailSubtitle}>{app.subtitle}</div>}
          </div>
        </div>

        {app.description && <p className={styles.description}>{app.description}</p>}

        {openStats?.last && (
          <p className={styles.lastOpened}>
            opened {openStats.count > 1 ? `${openStats.count}× · ` : ''}
            {formatRelativeTime(openStats.last)}
          </p>
        )}

        <a
          className={styles.detailAction}
          href={href}
          onClick={() => recordOpened(app.file)}
        >
          {actionLabel} {app.title}
          <span aria-hidden="true">{canOfferInstall && !installed ? '⤓' : '→'}</span>
        </a>

        <div className={styles.qrCanvasWrap}>
          <canvas ref={drawQr} width={200} height={200} />
        </div>
        <p className={styles.qrHint}>Scan to open on your phone</p>
        <p className={styles.qrUrl}>{qrUrl}</p>
      </Modal>
    </article>
  )
}
