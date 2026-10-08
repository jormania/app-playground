import { CuratorUnavailable } from '../curation/api'
import { SpotifyUnavailable } from '../spotify/client'
import s from '../styles/editorial.module.css'

/** Something a listener can read. Never a stack trace, never an upstream body. */
export function messageOf(e: unknown): string {
  if (e instanceof CuratorUnavailable || e instanceof SpotifyUnavailable) return e.message
  return 'Something didn’t work just now. Nothing you had was lost.'
}

export function Waiting({ children }: { children: React.ReactNode }) {
  return <p className={s.waiting} role="status">{children}</p>
}

export function Problem({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className={s.problem} role="alert">
      <p style={{ margin: 0 }}>{messageOf(error)}</p>
      {onRetry && <button className={s.textButton} onClick={onRetry}>Try again</button>}
    </div>
  )
}

/** Paragraphs from the curator's text: blank-line separated. */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return <div className={className}>{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
}
