import { useState } from 'react'
import { Gloss } from './Gloss'
import { CuratorUnavailable } from '../curation/api'
import { useServices } from '../app/services'
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

/**
 * The note to the curator (Notebook): read with every job, so capped too, but
 * given room for a few paragraphs — it is a standing note, not a question.
 * Everything else the curator is sent (a question, a wish, a mood, what stayed
 * with you, how a concert was) is held to MAX_ASK.
 */
export const MAX_NOTE = 2000

/** How close to a cap the count appears: quiet until then. */
const COUNT_FROM = 60

/** A quiet count under a capped field, only once fewer than sixty characters remain. */
export function CharCount({ value, max = MAX_ASK }: { value: string; max?: number }) {
  const left = max - value.length
  if (left >= COUNT_FROM) return null
  return <p className={s.charCount} aria-live="polite">{left === 1 ? '1 character left' : `${left} characters left`}</p>
}

/**
 * Where a curator request can't be made for want of a key: one line, the same
 * everywhere, with the way to Settings. `to` finishes the sentence.
 */
export function NeedsKey({ to = 'ask the curator' }: { to?: string }) {
  return <p className={s.needsKey}>Add your Anthropic key in <a href="#/settings">Settings</a> to {to}.</p>
}

/**
 * "Check now": recent Spotify listening read in on request — one button, one
 * set of words, wherever it is offered (the Journal, Settings).
 */
export function SpotifyCheckButton({ className, label = 'Check now' }: { className?: string; label?: string }) {
  const { syncSpotify, say } = useServices()
  const [checking, setChecking] = useState(false)
  async function check() {
    setChecking(true)
    try {
      const n = await syncSpotify()
      say(n ? 'Picked up your recent Spotify listening.' : 'Nothing new from Spotify.')
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setChecking(false)
    }
  }
  return <button className={className ?? s.textButton} onClick={() => void check()} disabled={checking}>{checking ? 'Checking…' : label}</button>
}

/** Something a listener can read. Never a stack trace, never an upstream body. */
export function messageOf(e: unknown): string {
  if (e instanceof CuratorUnavailable || e instanceof SpotifyUnavailable) return e.message
  return 'Something didn’t work just now. Nothing you had was lost.'
}

/**
 * Something being fetched or written, said one way everywhere. A whole screen
 * opening stands apart with room around it; `inline`, inside a part of a page
 * (a portrait being written, a fold), it keeps the page's own spacing.
 */
export function Waiting({ inline = false, children }: { inline?: boolean; children: React.ReactNode }) {
  return <p className={inline ? `${s.waiting} ${s.waitingInline}` : s.waiting} role="status">{children}</p>
}

/**
 * A load that failed. When there was nothing there to load (an old or mistyped
 * link), it says so and points the way back instead: "Try again" would only
 * fail the same way.
 */
export function Problem({ error, onRetry, notFound }: { error: unknown; onRetry?: () => void; notFound?: { text: string; link: { href: string; label: string } } }) {
  if (error instanceof NotFound) {
    const { text, link } = notFound ?? { text: 'There’s nothing at this address — perhaps an old link.', link: { href: href({ name: 'week' }), label: 'This week' } }
    // data-not-found: the router doesn't offer a way back to a page like this (app/router.ts).
    return <div data-not-found=""><Empty link={link}>{text}</Empty></div>
  }
  return (
    <div className={s.problem} role="alert">
      <p className={s.flush}>{messageOf(error)}</p>
      {onRetry && <button className={s.textButton} onClick={onRetry}>Try again</button>}
    </div>
  )
}

/** "13 October 2026", or with `time` "13 October 2026, 14:05" — in the listener's time zone, in words like every other date in the app. */
export function dateWords(at: string | number | Date, timeZone: string, time = false): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone }).format(new Date(at))
}

/** Paragraphs from the curator's text: blank-line separated. */
export function Paragraphs({ text, className, glossed = false }: { text: string; className?: string; /** Terms tappable for a definition (components/Gloss). */ glossed?: boolean }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return <div className={className}>{paras.map((p, i) => <p key={i}>{glossed ? <Gloss text={p} /> : p}</p>)}</div>
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
