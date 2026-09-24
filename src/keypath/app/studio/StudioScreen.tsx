import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../ds'
import type { Song } from '../../engine'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { useApp } from '../context'
import { noteLabel } from '../i18n'
import { TopBar } from '../screens/TopBar'
import { keyBoxes } from '../songs/keyGeometry'
import { SongLibrary } from '../songs/library'
import { PlayKeyboard } from '../songs/PlayKeyboard'
import { Playback, realClock, type Sink } from './playback'
import { MAX_TAKE_MS, Recorder, type Recording } from './recorder'
import { OutputChoice, useOutput } from './output'
import { MAX_KEPT, TakeRepo, type Take } from './takes'
import styles from './studio.module.css'

const LOW = 60
const HIGH = 84

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

/**
 * Studio (door D): play freely, over a Style if she likes, record it, keep
 * the takes she likes, play them back. From a song's report it opens as
 * "Make it yours", with that song's tune as a reminder.
 */
export function StudioScreen({ songId }: { songId?: string }) {
  const { t, store, profile, log, settings } = useApp()
  const repo = useMemo(() => new TakeRepo(store), [store])
  const library = useMemo(() => new SongLibrary(store), [store])
  const [takes, setTakes] = useState<Take[] | null>(null)
  const [song, setSong] = useState<Song | null>(null)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [recording, setRecording] = useState<{
    ms: number
    count: number
  } | null>(null)
  const [pending, setPending] = useState<(Recording & { style: boolean }) | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [sure, setSure] = useState<string | null>(null)

  const recorder = useRef<Recorder | null>(null)
  const recordStart = useRef(0)
  const styleOn = useRef(false)
  const styleDuringTake = useRef(false)
  const playback = useRef<Playback | null>(null)
  const live = useRef<Sink | null>(null)

  const profileId = profile?.id ?? null
  useEffect(() => {
    if (profileId) void repo.list(profileId).then(setTakes)
  }, [repo, profileId])
  useEffect(() => {
    if (songId) void library.get(songId, settings.language).then(setSong)
  }, [library, songId, settings.language])
  useEffect(() => {
    if (profileId) void log.add(profileId, songId ? { type: 'studio_opened', from: 'song', songId } : { type: 'studio_opened', from: 'door' })
  }, [log, profileId, songId])

  const label = useCallback((p: number) => noteLabel(p, settings.noteNames, settings.language), [settings.noteNames, settings.language])

  // The keyboard: her notes go to the recorder (and the keys on screen); Start/Stop tell whether a Style runs.
  const onMidi = useCallback((e: MidiEvent) => {
    if (e.type === 'realtime') {
      if (e.status === 0xfa) styleOn.current = true
      if (e.status === 0xfc) styleOn.current = false
      if (styleOn.current && recorder.current) styleDuringTake.current = true
      return
    }
    // While a take plays on the keyboard, anything it echoes back isn't her.
    if (playback.current?.playing) return
    recorder.current?.feed(e)
    if ((e.type === 'noteon' || e.type === 'noteoff') && isPlayerChannel(e.channel)) {
      const on = e.type === 'noteon'
      setHeld((h) => {
        const s = new Set(h)
        if (on) s.add(e.note)
        else s.delete(e.note)
        return s
      })
    }
  }, [])
  const kb = useKeyboard(onMidi)

  const output = useOutput(kb)
  const { route } = output

  const stopPlayback = useCallback(() => {
    playback.current?.stop()
    playback.current = null
    setPlayingId(null)
  }, [])
  useEffect(() => () => stopPlayback(), [stopPlayback])

  const play = (id: string, r: Recording) => {
    if (playingId === id) return stopPlayback()
    stopPlayback()
    const p = new Playback(r, output.sink(), realClock, () => {
      playback.current = null
      setPlayingId(null)
    })
    playback.current = p
    setPlayingId(id)
    p.start()
    if (profileId && id !== 'new')
      void log.add(profileId, {
        type: 'studio_played',
        takeId: id,
        via: route,
      })
  }

  // Recording: a live counter while it runs, and a hard stop at ten minutes.
  const stopRecording = useCallback(() => {
    const rec = recorder.current
    if (!rec) return
    recorder.current = null
    setRecording(null)
    const r = rec.stop(performance.now())
    if (r.notes.length === 0) {
      setMessage(t('studioNothing'))
      return
    }
    const style = styleDuringTake.current
    setPending({ ...r, style })
    if (profileId)
      void log.add(profileId, {
        type: 'studio_recorded',
        ms: r.ms,
        notes: r.notes.length,
        style,
        ...(songId ? { songId } : {}),
      })
  }, [t, profileId, log, songId])
  const startRecording = () => {
    stopPlayback()
    setPending(null)
    setMessage(null)
    styleDuringTake.current = styleOn.current
    recordStart.current = performance.now()
    recorder.current = new Recorder(recordStart.current)
    setRecording({ ms: 0, count: 0 })
  }
  const isRecording = recording !== null
  useEffect(() => {
    if (!isRecording) return
    const id = setInterval(() => {
      const rec = recorder.current
      if (!rec) return
      setRecording({
        ms: performance.now() - recordStart.current,
        count: rec.noteCount,
      })
    }, 250)
    return () => clearInterval(id)
  }, [isRecording])
  useEffect(() => {
    if (recording && recording.ms >= MAX_TAKE_MS) stopRecording()
  }, [recording, stopRecording])
  useEffect(() => () => void (recorder.current = null), [])

  const keep = async () => {
    if (!pending || !profileId) return
    const { style, ...r } = pending
    const take = await repo.keep(profileId, r, {
      style,
      ...(song ? { songId: song.id, songTitle: song.title } : {}),
    })
    if (!take) return setMessage(t('studioFull', { max: MAX_KEPT }))
    if (playingId === 'new') stopPlayback()
    setPending(null)
    setTakes(await repo.list(profileId))
    void log.add(profileId, { type: 'studio_kept', takeId: take.id })
  }
  const discard = () => {
    if (playingId === 'new') stopPlayback()
    setPending(null)
  }
  const toggleFavourite = async (take: Take) => {
    if (!profileId) return
    await repo.update(profileId, take.id, { favourite: !take.favourite })
    setTakes(await repo.list(profileId))
    void log.add(profileId, {
      type: 'studio_favourite',
      takeId: take.id,
      on: !take.favourite,
    })
  }
  const remove = async (take: Take) => {
    if (!profileId) return
    if (sure !== take.id) return setSure(take.id)
    if (playingId === take.id) stopPlayback()
    await repo.remove(profileId, take.id)
    setSure(null)
    setTakes(await repo.list(profileId))
    void log.add(profileId, { type: 'studio_deleted', takeId: take.id })
  }

  // The screen's own keys play too: on the keyboard or the phone, and into the take.
  const screenPress = (p: number) => {
    live.current ??= output.sink()
    live.current.noteOn(p, 80, performance.now())
    recorder.current?.noteOn(p, 80, performance.now())
    setHeld((h) => new Set(h).add(p))
  }
  const screenRelease = (p: number) => {
    live.current?.noteOff(p, performance.now())
    recorder.current?.noteOff(p, performance.now())
    setHeld((h) => {
      const s = new Set(h)
      s.delete(p)
      return s
    })
  }
  useEffect(() => {
    live.current = null // a new route gets a new sink on the next tap
  }, [route])

  const boxes = useMemo(() => keyBoxes(LOW, HIGH), [])
  const tune = useMemo(() => {
    if (!song) return null
    const bars = new Map<number, string[]>()
    for (const n of song.notes.filter((x) => x.hand === 'right')) {
      if (n.bar >= 8) break
      bars.set(n.bar, [...(bars.get(n.bar) ?? []), label(n.pitch)])
    }
    return [...bars.values()].map((b) => b.join(' ')).join('  |  ')
  }, [song, label])

  const nameOf = (take: Take) => (take.songTitle ? t('studioTakeOf', { title: take.songTitle, n: take.n }) : t('studioTakeN', { n: take.n }))

  return (
    <main className={styles.screen}>
      <TopBar title={t('doorStudio')} />
      <KeyboardStatus status={kb} missing="keyboardMissing" />

      <section className={styles.panel}>
        {song ? (
          <>
            <h2 className={styles.h2}>{t('studioMakeItYours', { title: song.title })}</h2>
            <p>{t('studioMakeItYoursBody')}</p>
            {tune && (
              <p className={styles.tune} aria-label={t('studioTune')}>
                {tune}
              </p>
            )}
          </>
        ) : (
          <p>{t('studioIntro')}</p>
        )}
      </section>

      <section className={styles.panel} aria-live="polite">
        <div className={styles.recordRow}>
          <button type="button" className={styles.record} data-recording={recording ? true : undefined} onClick={recording ? stopRecording : startRecording}>
            {recording ? t('studioStop') : t('studioRecord')}
          </button>
          {recording && (
            <span className={styles.recordStatus}>
              {t('studioRecording', {
                time: clock(recording.ms),
                count: recording.count,
              })}
            </span>
          )}
        </div>
        {message && <p className={styles.hint}>{message}</p>}
        {pending && (
          <div className={styles.pending}>
            <p>
              {t('studioTakeReady', {
                time: clock(pending.ms),
                count: pending.notes.length,
              })}
            </p>
            <div className={styles.actions}>
              <Button variant="outline" onClick={() => play('new', pending)}>
                {playingId === 'new' ? t('studioStopPlaying') : t('studioPlay')}
              </Button>
              <Button onClick={() => void keep()}>{t('studioKeep')}</Button>
              <Button variant="ghost" onClick={discard}>
                {t('studioDiscard')}
              </Button>
            </div>
          </div>
        )}
        <OutputChoice output={output} label={t('studioPlayOn')} phoneOnly={t('studioPlaysOnPhone')} />
      </section>

      <PlayKeyboard boxes={boxes} held={held} targets={new Set()} wrong={new Set()} label={label} names={settings.keyNames} onPress={screenPress} onRelease={screenRelease} />

      <section className={styles.panel}>
        <h2 className={styles.h2}>{t('studioMyTakes')}</h2>
        {takes && takes.length === 0 && <p className={styles.hint}>{t('studioNoTakes')}</p>}
        <ul className={styles.takes}>
          {takes?.map((take) => (
            <li key={take.id} className={styles.take}>
              <button
                type="button"
                className={styles.playButton}
                aria-label={`${playingId === take.id ? t('studioStopPlaying') : t('studioPlay')} ${nameOf(take)}`}
                onClick={() => play(take.id, take)}
              >
                {playingId === take.id ? '■' : '▶'}
              </button>
              <span className={styles.takeText}>
                <span className={styles.takeName}>{nameOf(take)}</span>
                <span className={styles.takeMeta}>
                  {clock(take.ms)} · {new Date(take.createdAt).toLocaleDateString(settings.language === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short' })}
                  {take.style && ` · ${t('studioWithStyle')}`}
                </span>
              </span>
              <button type="button" className={styles.star} aria-pressed={take.favourite} aria-label={t('studioFavourite')} onClick={() => void toggleFavourite(take)}>
                {take.favourite ? '★' : '☆'}
              </button>
              <Button size="sm" variant={sure === take.id ? 'danger' : 'ghost'} aria-label={sure === take.id ? t('studioSure') : t('studioDelete')} onClick={() => void remove(take)}>
                {sure === take.id ? t('studioSure') : '🗑'}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
