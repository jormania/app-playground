import { useId, useState } from 'react'
import { useServices } from '../app/services'
import { useKept } from '../app/kept'
import { go } from '../app/router'
import { CharCount, MAX_ASK, NeedsKey, messageOf } from './common'
import { Twisty } from './Twisty'
import s from '../styles/editorial.module.css'

/**
 * "A sitting for tonight": some weeks there is one evening, not seven. Say
 * what you'd like and how long you have; the curator writes the evening. With
 * a programme this week it is an evening of its own unless made beside the
 * theme (domain/evenings.ts); without one, it becomes the week's programme and
 * begins a thread.
 */
export function SittingCard({ joinsThread, busy = false, onMaking, keyHint = true, folded = false }: {
  joinsThread: boolean
  /** One folded line among Where next's ways on, rather than a card of its own. */
  folded?: boolean
  /** Something else on the screen is with the curator (a direction being chosen): wait for it. */
  busy?: boolean
  /** Told when this card starts and stops asking, so the screen can hold its other requests meanwhile. */
  onMaking?: (making: boolean) => void
  /** Say here that a key is needed; off where the screen already says it once. */
  keyHint?: boolean
}) {
  const { journey, bump, say, curatorReady } = useServices()
  const id = useId()
  // What was asked for stays until the evening is made: the app closed (or the phone put down) before tapping
  // "Make", or while the curator was still building it, leaves the request here, not lost with the page.
  const [request, setRequest, clearRequest] = useKept('sitting-request', 'device')
  const [hoursKept, setHoursKept, clearHours] = useKept('sitting-hours', 'device')
  const hours: 1 | 2 = hoursKept === '2' ? 2 : 1
  const setHours = (h: 1 | 2) => setHoursKept(String(h))
  // With a thread this week the evening may sit beside its theme, or stand on its own: what you ask for decides, so own is the default.
  const [beside, setBeside] = useState(false)
  const [making, setMaking] = useState(false)

  async function make() {
    setMaking(true)
    onMaking?.(true)
    try {
      const p = await journey.sitting(request, hours, joinsThread && !beside)
      clearRequest()
      clearHours()
      bump()
      go({ name: 'programme', id: p.id })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setMaking(false)
      onMaking?.(false)
    }
  }

  const body = (
    <>
      <p className={s.quiet}>
        One evening, not seven? Say what you’d like and how long you have.{' '}
        {joinsThread
          ? (beside ? 'It joins this week’s thread, with nothing you’ve already been given.' : 'Your words decide the music. It stands in the week’s timeline as an evening of its own, outside the theme.')
          : 'It becomes this week’s programme and begins its thread.'}
      </p>
      {/* A form, so Enter asks for the evening: one line, one request. */}
      <form className={s.cardForm} onSubmit={(e) => { e.preventDefault(); if (!making && !busy && curatorReady) void make() }}>
        <label className={s.visuallyHidden} htmlFor={id}>What would you like tonight?</label>
        <input id={id} className={s.input} maxLength={MAX_ASK} placeholder="quiet, nothing I know" value={request} onChange={(e) => setRequest(e.target.value)} disabled={making || busy} />
        <CharCount value={request} />
        {joinsThread && (
          <div className={s.chipRow} role="radiogroup" aria-label="How it relates to this week">
            {([false, true] as const).map((b) => (
              <button key={String(b)} type="button" role="radio" aria-checked={beside === b} className={`${s.chip} ${beside === b ? s.chipOn : ''}`} onClick={() => setBeside(b)} disabled={making || busy}>
                {b ? 'beside this week’s theme' : 'on its own'}
              </button>
            ))}
          </div>
        )}
        <div className={s.chipRow} role="radiogroup" aria-label="How long you have">
          {([1, 2] as const).map((h) => (
            <button key={h} type="button" role="radio" aria-checked={hours === h} className={`${s.chip} ${hours === h ? s.chipOn : ''}`} onClick={() => setHours(h)} disabled={making || busy}>
              {h === 1 ? 'about an hour' : 'about two hours'}
            </button>
          ))}
        </div>
        <button type="submit" className={s.outlineButton} disabled={making || busy || !curatorReady}>
          {making ? 'The curator is building it…' : 'Make tonight’s sitting'}
        </button>
      </form>
      {!curatorReady && keyHint && <NeedsKey />}
    </>
  )
  // A request not yet made is said on the folded line, so it is found again: the evening is not made until asked for.
  if (folded) return <Twisty label="A sitting for tonight" value={request.trim() ? `“${request.trim()}” — not made yet` : 'one or two hours, asked for today'} open={making}>{body}</Twisty>
  return (
    <div className={s.nextCard}>
      <h3 className={s.nextTitle}>A sitting for tonight</h3>
      {body}
    </div>
  )
}
