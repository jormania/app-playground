import { useId, useState } from 'react'
import { useServices } from '../app/services'
import { go } from '../app/router'
import { CharCount, MAX_ASK, NeedsKey, messageOf } from './common'
import { Twisty } from './Twisty'
import s from '../styles/editorial.module.css'

/**
 * "A sitting for tonight": some weeks there is one evening, not seven. Say
 * what you'd like and how long you have; the curator writes the evening —
 * joining this week's thread if there is one, or beginning one.
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
  const [request, setRequest] = useState('')
  const [hours, setHours] = useState<1 | 2>(1)
  const [making, setMaking] = useState(false)

  async function make() {
    setMaking(true)
    onMaking?.(true)
    try {
      const p = await journey.sitting(request, hours)
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
        {joinsThread ? 'It joins this week’s thread, with nothing you’ve already been given.' : 'It becomes this week’s programme and begins its thread.'}
      </p>
      {/* A form, so Enter asks for the evening: one line, one request. */}
      <form className={s.cardForm} onSubmit={(e) => { e.preventDefault(); if (!making && !busy && curatorReady) void make() }}>
        <label className={s.visuallyHidden} htmlFor={id}>What would you like tonight?</label>
        <input id={id} className={s.input} maxLength={MAX_ASK} placeholder="quiet, nothing I know" value={request} onChange={(e) => setRequest(e.target.value)} disabled={making || busy} />
        <CharCount value={request} />
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
  if (folded) return <Twisty label="A sitting for tonight" value="one or two hours, asked for today" open={making}>{body}</Twisty>
  return (
    <div className={s.nextCard}>
      <h3 className={s.nextTitle}>A sitting for tonight</h3>
      {body}
    </div>
  )
}
