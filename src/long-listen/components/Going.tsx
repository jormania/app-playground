import { Landmark } from 'lucide-react'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { isoDateIn } from '../domain/week'
import { goingKey, goingStage, whenWords, type Going } from '../domain/going'
import { venueShort, type LiveEvent } from '../live/live'
import { messageOf } from './common'
import { concertDate } from './ConcertEntry'
import s from '../styles/editorial.module.css'

/** The concerts marked as going, reloaded with everything else. */
export function useGoings(): Going[] {
  const { journey } = useServices()
  return useLoad(() => journey.goings(), []).data ?? []
}

/**
 * "I’m going": marks a concert from Live in Bucharest — the preparation and the pre-filled entry follow from it.
 * Marked, and in the week before it, the chip gives way to the way in: "Prepare for it →".
 */
export function GoingToggle({ event, goings }: { event: LiveEvent; goings: Going[] }) {
  const { journey, bump, say, settings } = useServices()
  const mine = goings.find((g) => g.key === goingKey(event))
  if (mine && goingStage(mine, isoDateIn(new Date(), settings.timeZone)) === 'ahead') {
    return <a className={s.textButton} href={href({ name: 'before', key: mine.key })}>Prepare for it →</a>
  }
  const on = Boolean(mine)
  const toggle = () => journey.goingTo(event, !on).then(bump, (e: unknown) => say(messageOf(e), 'danger'))
  return (
    <button type="button" className={`${s.chip} ${s.goingChip} ${on ? s.chipOn : ''}`} aria-pressed={on} aria-label={`${on ? 'Going' : 'I’m going'}: ${event.title}, ${concertDate(event.date)}`} onClick={() => void toggle()}>
      {on ? 'Going' : 'I’m going'}
    </button>
  )
}

/**
 * Before and after a concert, on this week's page: in the week before one
 * marked as going, a card to its preparation; once it has passed, a card to
 * add it to the concerts, already filled in. Nothing for a concert further off,
 * nor for one a line above already leads to (`skip`, by key).
 */
export function GoingCards({ skip }: { skip?: Set<string> }) {
  const { journey, bump, say, settings } = useServices()
  const goings = useGoings()
  const today = isoDateIn(new Date(), settings.timeZone)
  const shown = goings.filter((g) => ['ahead', 'after'].includes(goingStage(g, today)) && !skip?.has(g.key))
  if (!shown.length) return null
  const didntGo = (g: Going) => journey.goingTo(g.event, false).then(bump, (e: unknown) => say(messageOf(e), 'danger'))
  return (
    <div className={s.goingCards}>
      {shown.map((g) => {
        const after = goingStage(g, today) === 'after'
        return (
          <div key={g.key} className={s.goingCard}>
            <p className={s.goingHead}>
              <Landmark size={14} strokeWidth={1.7} aria-hidden="true" className={s.hallMark} />{' '}
              {after ? 'After the concert' : `Before the concert ${whenWords(g.event.date, today, g.event.time)}`} · {venueShort(g.event.venue)}
            </p>
            <p className={s.goingTitle}>{g.event.title}</p>
            {after
              ? <>
                  <a className={s.textButton} href={href({ name: 'concert', id: `from-${g.key}` })}>How was it? Add it to your concerts →</a>
                  {' '}<button type="button" className={`${s.textButton} ${s.quietButton}`} onClick={() => void didntGo(g)}>I didn’t go</button>
                </>
              : <a className={s.textButton} href={href({ name: 'before', key: g.key })}>Prepare for it →</a>}
          </div>
        )
      })}
    </div>
  )
}
