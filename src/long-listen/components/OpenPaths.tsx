import { useState } from 'react'
import type { ProgrammeOption, WeekKey } from '../domain/types'
import { sinceWords } from '../domain/week'
import { useServices } from '../app/services'
import { go } from '../app/router'
import { verifyProgramme } from '../spotify/verify'
import { ConfirmModal } from '../../ds'
import { NeedsKey, messageOf } from './common'
import { Twisty } from './Twisty'
import s from '../styles/editorial.module.css'

export const MOOD_WORD = { immersive: 'Immersive', curious: 'Curious', adventurous: 'Adventurous' } as const

/**
 * Directions offered in earlier weeks and not taken then — the same list
 * wherever it appears (This week, the programme's "Where next"):
 * each with its mood and when it was offered, its pitch, and "Take it this
 * week". Taking one asks first only when this week already has a programme,
 * which then stays in the journal. While the curator builds it, the button
 * says so in place.
 */
/** The paths shown at once; older ones wait in a fold below, so the list never runs on for a screen. */
export const RECENT_PATHS = 9

export function OpenPaths({ paths, nowKey, busy = false, onTaking, keyHint = true, single = false }: {
  paths: ProgrammeOption[]
  /** One path, as a line elsewhere (the Journal's "left open"): only its button, not its card. */
  single?: boolean
  nowKey: WeekKey
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

  const button = (o: ProgrammeOption, quiet = false) => (
    <button className={quiet ? `${s.textButton} ${s.inlineButton}` : `${s.outlineButton} ${s.smallButton}`} onClick={() => void take(o)} disabled={busy || taking !== null || !curatorReady}>
      {taking === o.id ? 'The curator is building it…' : quiet ? 'take it this week' : 'Take it this week'}
    </button>
  )
  const entry = (o: ProgrammeOption) => (
    <li key={o.id} className={s.entry}>
      <p className={s.mood}>{MOOD_WORD[o.mood]} · offered {sinceWords(o.weekKey, nowKey)}</p>
      <h4 className={s.nextOption}>{o.title}</h4>
      <p className={s.quiet}>{o.pitch}</p>
      <div className={s.actions}>{button(o)}</div>
    </li>
  )
  const recent = paths.slice(0, RECENT_PATHS)
  const older = paths.slice(RECENT_PATHS)
  return (
    <>
      {single
        ? paths.map((o) => <span key={o.id}>{curatorReady && button(o, true)}</span>)
        : (
          <>
            <ul className={s.entries}>{recent.map(entry)}</ul>
            {/* Every path stays takeable; the older ones are folded, the same on This week and in Where next. */}
            {older.length > 0 && (
              <Twisty label="Older directions" value={`from ${sinceWords(older[0].weekKey, nowKey)} and before`} open={older.some((o) => o.id === taking)}>
                <ul className={s.entries}>{older.map(entry)}</ul>
              </Twisty>
            )}
          </>
        )}
      {!curatorReady && keyHint && !single && <NeedsKey />}
      <ConfirmModal
        isOpen={confirming !== null}
        title="Take this direction instead?"
        message="This week already has a programme. It stays in your journal; the new one becomes this week’s."
        confirmText="Take this direction"
        onConfirm={() => { if (confirming) void take(confirming, true) }}
        onCancel={() => setConfirming(null)}
      />
    </>
  )
}
