import React from 'react'
import styles from './ErrorBoundary.module.css'

// Everything Lexi5 owns. Listed explicitly so "start fresh" can't reach another app's
// data — several apps share this origin.
const LEXI5_KEYS = [
  'lexi5_stats',
  'lexi5_game',
  'lexi5_config',
  'lexi5_custom_dict',
  'lexi5_custom_dict_epoch',
  'lexi5_custom_dict_theme',
  'lexi5_endless_progress',
  'lexi5_history',
]

/**
 * Last line of defence. Storage writes now go through src/shared/storage (which can't
 * throw), but a corrupted blob that parses yet has the wrong shape can still crash a
 * render — and without a boundary React unmounts the whole tree to a blank page with no
 * way back except devtools. This offers the one recovery a player can actually perform.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Lexi5 crashed:', error, info)
  }

  handleReset = () => {
    for (const key of LEXI5_KEYS) {
      try {
        localStorage.removeItem(key)
      } catch (_e) {
        // Nothing useful to do — the reload below is still worth attempting.
      }
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className={styles.wrap} role="alert">
        <h1 className={styles.title}>Lexi5 hit a problem</h1>
        <p className={styles.body}>
          Something went wrong loading your game. Reloading usually fixes it. If it keeps
          happening, your saved data may be damaged — starting fresh will clear your stats,
          settings and any curated word list.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
            Reload
          </button>
          <button type="button" className={styles.danger} onClick={this.handleReset}>
            Clear data and start fresh
          </button>
        </div>
        <pre className={styles.detail}>{String(this.state.error?.message || this.state.error)}</pre>
      </div>
    )
  }
}
