import { useState } from 'react'
import styles from './AppTile.module.css'

// installed: true (confirmed installed) | false (confirmed not installed) | null (unknown/unsupported browser)
export function AppTile({ app, installed }) {
  const [showError, setShowError] = useState(false)
  const href = `/${app.file}`

  function handleBlockedLaunch(e) {
    e.preventDefault()
    setShowError((v) => !v)
  }

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
        {installed === false ? (
          <>
            <button type="button" className={styles.notInstalled} onClick={handleBlockedLaunch}>
              Not installed
            </button>
            <a className={styles.fallbackLink} href={href}>
              Open in browser instead →
            </a>
          </>
        ) : (
          <a className={styles.launch} href={href}>
            {installed === true ? 'Launch →' : 'Open →'}
          </a>
        )}
      </div>

      {showError && installed === false && (
        <p className={styles.errorNote} role="alert">
          {app.title} isn't installed on this device yet — open it once, then use your
          browser's Install / Add to Home Screen prompt.
        </p>
      )}
    </article>
  )
}
