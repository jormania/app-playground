import { useState } from 'react'
import type { ProposedRecording, Recording } from '../domain/types'
import { creditLine } from '../domain/identity'
import { openUrl, searchUrl } from '../spotify/client'
import { aboutDuration, confirmMatch, isConfirmed, rejectMatch, verifyRecording } from '../spotify/verify'
import { useServices } from '../app/services'
import { messageOf } from './common'
import s from '../styles/editorial.module.css'

/**
 * One recommended recording: who plays it (as the curator proposed it), what
 * it is like, and what Spotify confirms. The two layers are kept visibly
 * apart. The credit line and character are the curator's; the album, release
 * year and ℗ line appear only once Spotify has matched those exact performers,
 * and a recording Spotify can't find gets a search, never a link to someone
 * else's performance of the same work. A near miss — the conductor right, the
 * orchestra not credited — is put to the listener as a question, and is not
 * linked, played or counted until they answer it.
 */
export function RecordingBlock({
  proposed, recording, character, onOpened, onFindAlternative, standInBelow = false, label = 'Recommended recording',
}: {
  proposed: ProposedRecording
  recording?: Recording
  character?: string
  onOpened?: (how: 'opened' | 'play-started') => void
  /** Offered when Spotify lacks this recording: ask the curator for one it has. */
  onFindAlternative?: () => void
  /** A recording Spotify does have is shown just below in its place. */
  standInBelow?: boolean
  label?: string
}) {
  const { spotify, repo, bump, say } = useServices()
  const [busy, setBusy] = useState(false)
  const query = [proposed.composer.split(' ').slice(-1)[0], proposed.work, proposed.conductor ?? proposed.soloists[0]?.name ?? proposed.orchestra ?? ''].join(' ')
  const sp = isConfirmed(recording) ? recording.spotify : undefined
  const near = recording?.verification === 'unconfirmed' ? recording.spotify : undefined
  const shown = sp ?? near
  const year = shown?.releaseDate?.slice(0, 4)

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

  async function yesThis() {
    if (!recording) return
    await confirmMatch(repo, recording.id)
    bump()
  }

  async function notThis() {
    if (!recording) return
    setBusy(true)
    try {
      const r = await rejectMatch(repo, spotify, recording.id, proposed)
      bump()
      if (r.verification === 'not-found') say('Noted. Spotify has nothing else that matches, so it’s marked as not found.')
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={s.recording}>
      <div className={s.label}>{label}</div>
      <p className={s.credit}>{creditLine(proposed) || 'Performers not named'}</p>
      {(character || recording?.character.length) ? (
        <p className={s.creditCharacter}>{character ?? recording?.character.join(', ')}</p>
      ) : null}

      {shown && (
        <div className={s.album}>
          {shown.imageUrl ? <img className={s.cover} src={shown.imageUrl} alt="" loading="lazy" width={64} height={64} /> : null}
          <div className={s.albumText}>
            <div className={s.albumName}>{shown.albumName}</div>
            <div>{[aboutDuration(shown.durationMs), year && `released ${year}`, shown.phonographic].filter(Boolean).join(' · ')}</div>
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
            {/* Even a strong match can be the same performers in another decade. */}
            {!sp.confirmedByListener && <button className={`${s.textButton} ${s.quietButton}`} onClick={notThis} disabled={busy}>{busy ? 'Looking again…' : 'Not this recording?'}</button>}
          </>
        ) : near ? (
          <a href={openUrl('album', near.albumId)} target="_blank" rel="noopener noreferrer">Look at it in Spotify</a>
        ) : recording?.verification === 'not-found' ? (
          <a href={searchUrl(query)} target="_blank" rel="noopener noreferrer">Search Spotify</a>
        ) : spotify.connected && recording ? (
          <button className={s.textButton} onClick={check} disabled={busy}>{busy ? 'Looking on Spotify…' : 'Find this recording on Spotify'}</button>
        ) : (
          <a href={searchUrl(query)} target="_blank" rel="noopener noreferrer">Look for it on Spotify</a>
        )}
      </div>

      {near && (
        <p className={s.note}>
          Spotify has something close, credited to {near.artistNames.join(', ') || 'other performers'}. Is it the recording the curator meant?
          Same conductor can mean a different decade and a different reading, so it isn’t linked or played until you say.{' '}
          <button className={s.textButton} onClick={yesThis} disabled={busy}>Yes, this is it</button>{' '}
          <button className={s.textButton} onClick={notThis} disabled={busy}>{busy ? 'Looking again…' : 'Not this one'}</button>
        </p>
      )}
      {sp?.confidence === 'probable' && sp.confirmedByListener && (
        <p className={s.note}>
          You confirmed this one; Spotify credits it a little differently from the curator.{' '}
          <button className={s.textButton} onClick={notThis} disabled={busy}>Not this one after all</button>
        </p>
      )}
      {recording?.verification === 'not-found' && (
        <p className={s.note}>
          {standInBelow
            ? 'Spotify doesn’t carry this exact recording, so the curator picked one it does, below.'
            : 'Spotify doesn’t appear to carry this exact recording. The curator’s choice stands; it may be elsewhere.'}
          {!standInBelow && onFindAlternative && <>{' '}<button className={s.textButton} onClick={onFindAlternative}>Ask for one that’s on Spotify</button></>}
        </p>
      )}
      {!shown && recording?.verification !== 'not-found' && !spotify.connected && (
        <p className={s.note}>Connect Spotify in Settings to confirm the exact recording.</p>
      )}
    </div>
  )
}
