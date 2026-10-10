import { useId, useState } from 'react'
import { useServices } from '../app/services'
import { go } from '../app/router'
import { messageOf } from './common'
import s from '../styles/editorial.module.css'

/**
 * "A sitting for tonight": some weeks there is one evening, not seven. Say
 * what you'd like and how long you have; the curator writes the evening —
 * joining this week's thread if there is one, or beginning one.
 */
export function SittingCard({ joinsThread }: { joinsThread: boolean }) {
  const { journey, bump, say, curatorReady } = useServices()
  const id = useId()
  const [request, setRequest] = useState('')
  const [hours, setHours] = useState<1 | 2>(1)
  const [making, setMaking] = useState(false)

  async function make() {
    setMaking(true)
    try {
      const p = await journey.sitting(request, hours)
      bump()
      go({ name: 'programme', id: p.id })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setMaking(false)
    }
  }

  return (
    <div className={s.nextCard}>
      <h3 className={s.nextTitle}>A sitting for tonight</h3>
      <p className={s.quiet}>
        One evening, not seven? Say what you’d like and how long you have.{' '}
        {joinsThread ? 'It joins this week’s thread, with nothing you’ve already been given.' : 'It becomes this week’s programme and begins its thread.'}
      </p>
      <label className={s.visuallyHidden} htmlFor={id}>What would you like tonight?</label>
      <input id={id} className={s.input} placeholder="quiet, nothing I know" value={request} onChange={(e) => setRequest(e.target.value)} disabled={making} />
      <div className={s.chipRow} role="radiogroup" aria-label="How long you have">
        {([1, 2] as const).map((h) => (
          <button key={h} type="button" role="radio" aria-checked={hours === h} className={`${s.chip} ${hours === h ? s.chipOn : ''}`} onClick={() => setHours(h)} disabled={making}>
            {h === 1 ? 'about an hour' : 'about two hours'}
          </button>
        ))}
      </div>
      <button className={s.outlineButton} onClick={() => void make()} disabled={making || !curatorReady}>
        {making ? 'The curator is shaping your evening…' : 'Make tonight’s sitting'}
      </button>
      {!curatorReady && <p className={s.settingHint}>Add your Anthropic key in Settings to ask the curator.</p>}
    </div>
  )
}
