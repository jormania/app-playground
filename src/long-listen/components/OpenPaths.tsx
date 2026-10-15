import { useState } from 'react'
import type { ProgrammeOption, WeekKey } from '../domain/types'
import { sinceWords } from '../domain/week'
import { useServices } from '../app/services'
import { go } from '../app/router'
import { verifyProgramme } from '../spotify/verify'
import { ConfirmModal } from '../../ds'
import { NeedsKey, messageOf } from './common'
import s from '../styles/editorial.module.css'

export const MOOD_WORD = { immersive: 'Immersive', curious: 'Curious', adventurous: 'Adventurous' } as const

/**
 * Directions offered in earlier weeks and not taken then — the same list
 * wherever it appears (This week, the programme's "Where next"):
 * each with its mood and when it was offered, its pitch, and "Take this path
 * now". Taking one asks first only when this week already has a programme,
 * which then stays in the journal. While the curator builds it, the button
 * says so in place.
 */
export function OpenPaths({ paths, nowKey, level = 4, busy = false, onTaking, keyHint = true }: {
  paths: ProgrammeOption[]
  nowKey: WeekKey
  /** The heading level of each path's title, under the heading it sits beneath. */
  level?: 3 | 4
  /** Something else on the screen is with the curator: wait for it. */
  busy?: boolean
  /** Told when a path starts and stops being taken, so the screen can hold its other requests. */
  onTaking?: (id: string | null) => void
  /** Say here that a key is needed; off where the screen already says it once. */
  keyHint?: boolean
}) {
  const { journey, repo, spotify, bump, say, curatorReady } = useServices()
  const [taking, setTaking] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<ProgrammeOption | null>(null)
  const Title = level === 3 ? 'h3' : 'h4'

  function hold(id: string | null) {
    setTaking(id)
    onTaking?.(id)
  }

  async function take(o: ProgrammeOption, confirmed = false) {
    setConfirming(null)
    // Held from the first tap: a second one while the week is read would take it twice.
    hold(o.id)
    try {
      const thisWeek = await repo.weeks.get(nowKey)
      if (thisWeek?.programmeId && !confirmed) {
        hold(null)
        setConfirming(o)
        return
      }
      await journey.weekWithoutDirections()
      const p = await journey.takeOpenPath(o.id)
      // Start confirming its recordings now, before the page has even drawn.
      void verifyProgramme(repo, spotify, p.id, bump).catch(() => {})
      bump()
      go({ name: 'programme', id: p.id })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      hold(null)
    }
  }

  return (
    <>
      <ul className={s.entries}>
        {paths.map((o) => (
          <li key={o.id} className={s.entry}>
            <p className={s.mood}>{MOOD_WORD[o.mood]} · offered {sinceWords(o.weekKey, nowKey)}</p>
            <Title className={s.nextOption}>{o.title}</Title>
            <p className={s.quiet}>{o.pitch}</p>
            <div className={s.actions}>
              <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => void take(o)} disabled={busy || taking !== null || !curatorReady}>
                {taking === o.id ? 'The curator is building it…' : 'Take this path now'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!curatorReady && keyHint && <NeedsKey />}
      <ConfirmModal
        isOpen={confirming !== null}
        title="Take this path instead?"
        message="This week already has a programme. It stays in your journal; the new one becomes this week’s."
        confirmText="Take this path"
        onConfirm={() => { if (confirming) void take(confirming, true) }}
        onCancel={() => setConfirming(null)}
      />
    </>
  )
}
