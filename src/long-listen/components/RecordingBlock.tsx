import { useState } from 'react'
import type { ProposedRecording, Recording } from '../domain/types'
import { creditLine } from '../domain/identity'
import { openUrl, searchUrl } from '../spotify/client'
import { aboutDuration, forgetMatch, verifyRecording } from '../spotify/verify'
import { useServices } from '../app/services'
import { messageOf } from './common'
import s from '../styles/editorial.module.css'

/**
 * One recommended recording: who plays it (as the curator proposed it), what
 * it is like, and what Spotify confirms. The two layers are kept visibly
 * apart. The credit line and character are the curator's; the album, release
 * year and ℗ line appear only once Spotify has matched those exact performers,
 * and a recording Spotify can't find gets a search, never a link to someone
 * else's performance of the same work.
 */
export function RecordingBlock({
  proposed, recording, character, onOpened, onFindAlternative, label = 'Recommended recording',
}: {
  proposed: ProposedRecording
  recording?: Recording
  character?: string
  onOpened?: (how: 'opened' | 'play-started') => void
  /** Offered when Spotify lacks this recording: ask the curator for one it has. */
  onFindAlternative?: () => void
  label?: string
}) {
  const { spotify, repo, bump, say } = useServices()
  const [busy, setBusy] = useState(false)
  const query = [proposed.composer.split(' ').slice(-1)[0], proposed.work, proposed.conductor ?? proposed.soloists[0]?.name ?? proposed.orchestra ?? ''].join(' ')
  const sp = recording?.verification === 'verified' ? recording.spotify : undefined
  const year = sp?.releaseDate?.slice(0, 4)

  async function check() {
    if (!recording) return
    setBusy(true)
    try {
      const out = await verifyRecording(repo, spotify, recording.id, proposed)
      bump()
      if (out.recording.verification === 'not-found') say('Spotify doesn’t seem to have this exact recording.')
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function play() {
    if (!sp) return
    try {
      await spotify.play(sp.trackUris)
      onOpened?.('play-started')
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }

  async function notThis() {
    if (!recording) return
    await forgetMatch(repo, recording.id)
    bump()
  }

  return (
    <div className={s.recording}>
      <div className={s.label}>{label}</div>
      <p className={s.credit}>{creditLine(proposed) || 'Performers not named'}</p>
      {(character || recording?.character.length) ? (
        <p className={s.creditCharacter}>{character ?? recording?.character.join(', ')}</p>
      ) : null}

      {sp && (
        <div className={s.album}>
          {sp.imageUrl ? <img className={s.cover} src={sp.imageUrl} alt="" loading="lazy" width={64} height={64} /> : null}
          <div className={s.albumText}>
            <div className={s.albumName}>{sp.albumName}</div>
            <div>{[aboutDuration(sp.durationMs), year && `released ${year}`, sp.phonographic].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      )}

      <div className={s.actions}>
        {sp ? (
          <>
            <a href={openUrl('track', sp.trackIds[0])} target="_blank" rel="noopener noreferrer" onClick={() => onOpened?.('opened')}>
              Open in Spotify
            </a>
            {spotify.connected && <button className={s.textButton} onClick={play}>Play on your device</button>}
          </>
        ) : recording?.verification === 'not-found' ? (
          <a href={searchUrl(query)} target="_blank" rel="noopener noreferrer">Search Spotify</a>
        ) : spotify.connected && recording ? (
          <button className={s.textButton} onClick={check} disabled={busy}>{busy ? 'Looking on Spotify…' : 'Find this recording on Spotify'}</button>
        ) : (
          <a href={searchUrl(query)} target="_blank" rel="noopener noreferrer">Look for it on Spotify</a>
        )}
      </div>

      {sp?.confidence === 'probable' && (
        <p className={s.note}>
          Spotify credits this a little differently from the curator — worth a glance before you settle in.{' '}
          <button className={s.textButton} onClick={notThis}>Not this one</button>
        </p>
      )}
      {recording?.verification === 'not-found' && (
        <p className={s.note}>
          Spotify doesn’t appear to carry this exact recording. The curator’s choice stands; it may be elsewhere.
          {onFindAlternative && <>{' '}<button className={s.textButton} onClick={onFindAlternative}>Ask for one that’s on Spotify</button></>}
        </p>
      )}
      {!sp && recording?.verification !== 'not-found' && !spotify.connected && (
        <p className={s.note}>Connect Spotify in Settings to confirm the exact recording.</p>
      )}
    </div>
  )
}
