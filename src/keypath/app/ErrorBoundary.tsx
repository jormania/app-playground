import { Component, type ReactNode } from 'react'
import { Button } from '../../ds'
import styles from './app.module.css'

interface Props {
  children: ReactNode
  title: string
  body: string
  home: string
  reload: string
  onHome: () => void
}

/**
 * A screen that throws while drawing shows this instead of an empty page,
 * with a way back. It sits inside the view keyed by the route, so going
 * anywhere else starts that screen afresh. Nothing saved is touched.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('KeyPath: a screen failed', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className={styles.screen}>
        <section className={styles.crash} role="alert">
          <h1 className={styles.crashTitle}>{this.props.title}</h1>
          <p>{this.props.body}</p>
          <div className={styles.crashActions}>
            <Button onClick={this.props.onHome}>{this.props.home}</Button>
            <Button variant="outline" onClick={() => location.reload()}>
              {this.props.reload}
            </Button>
          </div>
        </section>
      </main>
    )
  }
}
