import { CuratorUnavailable } from '../curation/api'
import { SpotifyUnavailable } from '../spotify/client'
import { NotFound } from '../store/repo'
import { href } from '../app/router'
import s from '../styles/editorial.module.css'

/**
 * The most a listener may type into anything sent to the curator — a question,
 * a mood, an evening asked for. Room for a paragraph; a pasted page would only
 * be paid for, and could crowd out what the curator is there to read.
 */
export const MAX_ASK = 500

/** Something a listener can read. Never a stack trace, never an upstream body. */
export function messageOf(e: unknown): string {
  if (e instanceof CuratorUnavailable || e instanceof SpotifyUnavailable) return e.message
  return 'Something didn’t work just now. Nothing you had was lost.'
}

export function Waiting({ children }: { children: React.ReactNode }) {
  return <p className={s.waiting} role="status">{children}</p>
}

/**
 * A load that failed. When there was nothing there to load (an old or mistyped
 * link), it says so and points the way back instead: "Try again" would only
 * fail the same way.
 */
export function Problem({ error, onRetry, notFound }: { error: unknown; onRetry?: () => void; notFound?: { text: string; link: { href: string; label: string } } }) {
  if (error instanceof NotFound) {
    const { text, link } = notFound ?? { text: 'There’s nothing at this address — perhaps an old link.', link: { href: href({ name: 'week' }), label: 'This week' } }
    return <Empty link={link}>{text}</Empty>
  }
  return (
    <div className={s.problem} role="alert">
      <p className={s.flush}>{messageOf(error)}</p>
      {onRetry && <button className={s.textButton} onClick={onRetry}>Try again</button>}
    </div>
  )
}

/** Paragraphs from the curator's text: blank-line separated. */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return <div className={className}>{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
}

/**
 * A page with nothing in it yet: a small ornament, one sentence on how it
 * fills, and — where there is one — the way to start. Not an apology.
 */
export function Empty({ children, link }: { children: React.ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className={s.empty}>
      <p>{children}</p>
      {link && <a href={link.href}>{link.label}</a>}
    </div>
  )
}
