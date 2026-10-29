import { useState } from 'react'
import type { ProposedRecording, Recording } from '../domain/types'
import { openUrl, searchUrl } from '../spotify/client'
import { confirmMatch, isConfirmed, rejectMatch, verifyOne, beforeReject, undoReject, type RejectUndo } from '../spotify/verify'
import { useServices } from '../app/services'
import { messageOf } from './common'
import { ListenBar } from './ListenBar'
import { usePlayback } from '../app/playback'
import { Credits, performerLine } from '../components/Credits'
import { displaySurname } from '../domain/identity'
import { primeMinutes } from '../domain/programmeStyle'
import { Traits } from './Traits'
import s from '../styles/editorial.module.css'
import { ConfirmModal } from '../../ds'

/** What to search Spotify for, by hand: the surname as written ("Strauss", not "II"), the work, and who leads it. */
export function spotifyQuery(p: ProposedRecording): string {
  return [displaySurname(p.composer), p.work, p.conductor ?? p.soloists[0]?.name ?? p.orchestra ?? ''].join(' ').trim()
}

/**
 * One recommended recording: who plays it (as the curator proposed it), what
 * it is like, and what Spotify confirms. The two layers are kept visibly
 * apart. The credit line and character are the curator's; the album, release
 * year and ℗ line appear only once Spotify has matched those exact performers,
 * and a recording Spotify can't find gets a search, never a link to someone
 * else's performance of the same work. A near miss — the conductor right, the
 * orchestra not credited — is put to the listener as a question, and is not
 * linked, played or counted until they answer it. That Spotify isn't
 * connected is said once by the page, not under every recording.
 */
export function RecordingBlock({
  proposed, recording, character, onOpened, onFindAlternative, standInBelow = false, label = 'Recommended recording', durationAbove = false,
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
  /** The work's heading already prints its length (the programme's item): not said twice. */
  durationAbove?: boolean
}) {
  const { spotify, repo, bump, say } = useServices()
  const [busy, setBusy] = useState(false)
  const query = spotifyQuery(proposed)
  const sp = isConfirmed(recording) ? recording.spotify : undefined
  const near = recording?.verification === 'unconfirmed' ? recording.spotify : undefined
  const shown = sp ?? near
  const year = shown?.releaseDate?.slice(0, 4)
  const playback = usePlayback(sp?.trackUris, sp?.trackIds, sp?.trackDurationsMs)

  async function check() {
    if (!recording) return
    setUndo(null)
    setBusy(true)
    try {
      // Shares a look already running for it (the programme's background pass, a second tap) — never a second one racing it.
      const out = await verifyOne(repo, spotify, recording.id, proposed)
      bump()
      if (out.recording.verification === 'not-found') say('Spotify doesn’t seem to have this exact recording.')
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function yesThis() {
    if (!recording) return
    // A later answer stands: the undo would put back what came before it.
    setUndo(null)
    setBusy(true)
    try {
      await confirmMatch(repo, recording.id)
      bump()
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  // "Not this one" undoes a match, forgets its Spotify listening and looks again: asked first, and undoable after.
  const [asking, setAsking] = useState(false)
  const [undo, setUndo] = useState<{ was: RejectUndo; album: string } | null>(null)

  async function notThis() {
    if (!recording) return
    setAsking(false)
    setBusy(true)
    let was: RejectUndo | undefined
    try {
      was = await beforeReject(repo, recording.id)
      const r = await rejectMatch(repo, spotify, recording.id, proposed)
      say(r.verification === 'not-found' ? 'Set aside. Spotify has nothing else that matches, so it’s marked as not found.'
        : r.verification === 'unchecked' ? 'Set aside. Connect Spotify and it will look for another recording.'
        : 'Set aside. Spotify was asked for another recording.')
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      // Offered whatever the look for another did: a look that failed (offline, signed out) has still set this one aside.
      if (was) setUndo({ was, album: was.recording.spotify?.albumName ?? 'that album' })
      bump()
      setBusy(false)
    }
  }

  async function takeBack() {
    if (!undo) return
    setBusy(true)
    try {
      await undoReject(repo, undo.was)
      setUndo(null)
      bump()
      say('Put back as it was.', 'success')
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  // Spotify doesn't carry the curator's recording, and a stand-in plays below: one quiet line says whose
  // it was, and everything else — the playing, a search, the stand-in's tags and the way to play — is the stand-in's.
  if (recording?.verification === 'not-found' && standInBelow) {
    return (
      <div className={`${s.recording} ${s.recordingAside}`}>
        <p className={`${s.note} ${s.flush}`}>
          The curator’s choice, {performerLine(proposed) || 'unnamed performers'}, isn’t on Spotify.
        </p>
      </div>
    )
  }

  return (
    <div className={s.recording}>
      <div className={s.label}>{label}</div>
      <Credits r={proposed} className={s.credit} empty="Performers not named" programme />
      {/* Asked as every doubt in the app is asked (a path taken over this week's, a concert removed). */}
      <ConfirmModal
        isOpen={asking}
        title="Set this recording aside?"
        message="Spotify is asked for another of the same performers; if it finds one, that takes this one’s place, and what Spotify heard of this one is forgotten. You can undo it straight after."
        confirmText="Set it aside"
        cancelText="Keep this one"
        onConfirm={() => void notThis()}
        onCancel={() => setAsking(false)}
      />
      {/* Right under who plays it: the doubt is about this recording, before anything plays it. */}
      {undo ? (
        <p className={s.note} role="status">
          Set aside the recording on <em>{undo.album}</em>.{' '}
          <button className={`${s.textButton} ${s.inlineButton}`} onClick={() => void takeBack()} disabled={busy}>Undo</button>
        </p>
      ) : sp && !sp.confirmedByListener ? (
        // Even a strong match can be the same performers in another decade.
        <p className={`${s.note} ${s.flush}`}>
          <button className={`${s.textButton} ${s.quietButton}`} onClick={() => setAsking(true)} disabled={busy}>{busy ? 'Looking again…' : 'Not this recording?'}</button>
        </p>
      ) : null}
      <Traits label="The playing" words={character ?? recording?.character} />

      {shown && (
        <div className={s.album}>
          {shown.imageUrl ? <img className={s.cover} src={shown.imageUrl} alt="" loading="lazy" width={64} height={64} /> : null}
          <div className={s.albumText}>
            <div className={s.albumName}>{shown.albumName}</div>
            <div>{[durationAbove ? '' : primeMinutes(shown.durationMs), year && `released ${year}`, shown.phonographic].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      )}

      {sp ? (
        <ListenBar
          trackIds={sp.trackIds}
          durationsMs={sp.trackDurationsMs}
          durationMs={sp.durationMs}
          playback={playback}
          onStarted={() => onOpened?.('play-started')}
          onOpened={() => onOpened?.('opened')}
        />
      ) : near || recording?.verification === 'not-found' ? null : (
        // Not found: no search by hand either. Spotify was searched more thoroughly than a person would,
        // so the way forward is a recording it does have ("Ask for one that's on Spotify", below).
        <div className={s.actions}>
          {spotify.connected && recording ? (
            <button className={s.outlineButton} onClick={check} disabled={busy}>{busy ? 'Looking on Spotify…' : 'Find this recording on Spotify'}</button>
          ) : (
            // Without Spotify connected, a quiet link: Listen along below is the way in, and it shouldn't sit second to a search.
            <a className={s.searchLink} href={searchUrl(query)} target="_blank" rel="noopener noreferrer">Look for it on Spotify ↗</a>
          )}
        </div>
      )}

      {near && (
        <p className={s.note}>
          Spotify has something close, credited to {near.artistNames.join(', ') || 'other performers'}. Is it the recording the curator meant?
          Same conductor can mean a different decade and a different reading, so it isn’t linked or played until you say.{' '}
          <a href={openUrl('album', near.albumId)} target="_blank" rel="noopener noreferrer">Look at it in Spotify</a> first, if you like.
        </p>
      )}
      {near && (
        // Two answers, set apart: one tap on the wrong one links (or drops) a recording.
        <div className={`${s.actions} ${s.mtSm}`}>
          <button className={`${s.outlineButton} ${s.smallButton}`} onClick={yesThis} disabled={busy}>Yes, this is it</button>
          <button className={s.textButton} onClick={() => void notThis()} disabled={busy}>{busy ? 'Looking again…' : 'Not this one'}</button>
        </div>
      )}
      {sp?.confidence === 'probable' && sp.confirmedByListener && (
        <p className={s.note}>
          You confirmed this one; Spotify credits it a little differently from the curator.{' '}
          <button className={s.textButton} onClick={() => setAsking(true)} disabled={busy}>Not this one after all</button>
        </p>
      )}
      {recording?.verification === 'not-found' && (
        <p className={s.note}>
          Spotify doesn’t appear to carry this exact recording. The curator’s choice stands; it may be elsewhere.
          {onFindAlternative && <>{' '}<button className={s.textButton} onClick={onFindAlternative}>Ask for one that’s on Spotify</button></>}
        </p>
      )}
    </div>
  )
}
