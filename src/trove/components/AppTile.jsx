import styles from './AppTile.module.css'

// installed: true when the browser has genuinely confirmed this app is
// installed — anything else (false, null, unsupported browser) is treated as
// "unknown", not "not installed". A confirmed real install from a Chromium
// user still reads as false sometimes (Chrome throttles
// getInstalledRelatedApps() to prevent it being used to fingerprint a
// device's installed apps), so a negative result here can't be trusted
// enough to show as an error — see TROVE.md.
export function AppTile({ app, installed }) {
  const href = `/${app.file}`

  return (
    <article className={styles.tile}>
      <div className={styles.top}>
        <div className={styles.icon} style={{ background: app.iconBg || 'var(--color-glow)' }}>
          {app.emoji}
        </div>
        <div className={styles.meta}>
          <div className={styles.title}>{app.title}</div>
          <div className={styles.subtitle}>{app.subtitle}</div>
        </div>
      </div>

      {app.description && (
        <details className={styles.details}>
          <summary>More</summary>
          <p className={styles.description}>{app.description}</p>
        </details>
      )}

      <div className={styles.actionRow}>
        <a className={styles.launch} href={href}>
          {installed ? 'Launch →' : 'Open →'}
        </a>
      </div>
    </article>
  )
}
