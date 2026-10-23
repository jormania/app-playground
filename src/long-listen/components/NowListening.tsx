import { useEffect, useState } from 'react'
import { useServices } from '../app/services'
import { usePlayerState, savedPlace } from '../app/playback'
import { href, type Route } from '../app/router'
import { leftPartWay, listenTargetFor, type ListenTarget } from '../domain/nowListening'
import { curly } from '../domain/programmeStyle'
import { displaySurname } from '../domain/identity'
import s from '../styles/editorial.module.css'

/**
 * The listening view's own mark: a point sounding, its sound going out in
 * arcs. The arcs breathe while the music plays (still, where motion is
 * unwelcome), and rest while it's paused or only left part-way.
 */
export function ListeningMark({ live = false, size = 18 }: { live?: boolean; size?: number }) {
  return (
    <svg className={live ? `${s.listeningMark} ${s.listeningLive}` : s.listeningMark} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="6" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path className={s.listeningArc1} d="M10.5 8.5a5 5 0 0 1 0 7" />
      <path className={s.listeningArc2} d="M14 5.5a9.2 9.2 0 0 1 0 13" />
      <path className={s.listeningArc3} d="M17.5 2.8a13 13 0 0 1 0 18.4" />
    </svg>
  )
}

type Shown = ListenTarget & { how: 'playing' | 'paused' | 'left' }

/**
 * In the masthead, beside the guide and Settings: back to the listening view of
 * the work that is sounding — from any screen, whichever device it plays on and
 * however it was started (the app, the week's playlist, Spotify itself). Paused,
 * it still leads there. With nothing playing, it leads back to the work left
 * part-way most recently. Nothing to return to, or already
 * there: not shown at all.
 */
export function NowListening({ route }: { route: Route }) {
  const { repo, version, week, spotify } = useServices()
  const player = usePlayerState()
  const np = player.np
  const [shown, setShown] = useState<Shown | null>(null)
  const trackKey = `${np?.trackId ?? ''}|${np?.linkedFromId ?? ''}`
  const playing = Boolean(np?.isPlaying)

  useEffect(() => {
    let live = true
    void (async () => {
      const [recordings, programmes, comparisons] = await Promise.all([repo.recordings.all(), repo.programmes.all(), repo.comparisons.all()])
      const now = np ? listenTargetFor([np.trackId, np.linkedFromId], { recordings, programmes, comparisons }, week.key) : null
      if (now) { if (live) setShown({ ...now, how: playing ? 'playing' : 'paused' }); return }
      // Nothing of the app's sounding: the work left part-way most recently, however it was played — the programme's
      // Resume, the listening view or Spotify itself (it used to need the listening view opened, and missed the rest).
      const left = spotify.connected ? leftPartWay({ recordings, programmes, comparisons }, (ids) => savedPlace(ids)) : null
      if (live) setShown(left ? { ...left, how: 'left' } : null)
    })().catch(() => { if (live) setShown(null) })
    return () => { live = false }
    // The track and whether it plays decide it; the store's version brings a newly confirmed recording in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, playing, version, week.key, repo, spotify.connected])

  if (!shown) return null
  if (route.name === 'listen' && route.programmeId === shown.programmeId && route.itemId === shown.itemId) return null
  const what = `${displaySurname(shown.composer)}, ${curly(shown.work)}`
  const label = shown.how === 'playing' ? `Listen along: ${what}, playing now` : shown.how === 'paused' ? `Listen along: ${what}, paused` : `Back to ${what}, where you left it`
  return (
    <a className={`${s.iconLink} ${shown.how === 'playing' ? s.iconOn : ''}`} href={href({ name: 'listen', programmeId: shown.programmeId, itemId: shown.itemId })} aria-label={label} title={label}>
      <ListeningMark live={shown.how === 'playing'} />
    </a>
  )
}
