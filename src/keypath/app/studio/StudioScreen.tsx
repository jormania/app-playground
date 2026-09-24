import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Field, SegmentedControl } from '../../../ds'
import type { Song } from '../../engine'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { useApp } from '../context'
import { noteLabel } from '../i18n'
import { PREFIX } from '../store'
import { TopBar } from '../screens/TopBar'
import { keyBoxes, widenRange } from '../songs/keyGeometry'
import { useWide, WIDE_OCTAVES } from '../songs/useWide'
import { SongLibrary } from '../songs/library'
import { PlayKeyboard } from '../songs/PlayKeyboard'
import { Playback, realClock, type Sink } from './playback'
import { midiFilename, takeToSmf } from './midiExport'
import { MAX_TAKE_MS, Recorder, type Recording } from './recorder'
import { OutputChoice, useOutput } from './output'
import { saveFile } from './saveFile'
import { MAX_KEPT, MAX_NAME, TakeRepo, type Take } from './takes'
import styles from './studio.module.css'

const LOW = 60
const HIGH = 84

/** Count-in tempos on offer; 0 is off. Chosen once per phone, like where takes play. */
const COUNT_INS = [0, 60, 80, 100, 120] as const
const COUNT_IN_KEY = `${PREFIX}studioCountIn`
const CLICK = 84 // C6 on the piano, as in Challenges' rhythm echo
const BEATS = 4

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
  const [pending, setPending] = useState<(Recording & { style: boolean; bpm?: number }) | null>(null)
  const [countIn, setCountIn] = useState(0)
  /** Clicks still to come before recording starts; null when not counting in. */
  const [counting, setCounting] = useState<number | null>(null)
  /** The take whose name, file and delete are open. */
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState<{ id: string; text: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [sure, setSure] = useState<string | null>(null)

  const recorder = useRef<Recorder | null>(null)
  const recordStart = useRef(0)
  /** Keys before this don't go into the take: the count-in's noodling. Half a beat early still counts, as the downbeat. */
  const recordFrom = useRef(-Infinity)
  const takeBpm = useRef<number | undefined>(undefined)
  const countingIn = useRef<(() => void) | null>(null)
  const styleOn = useRef(false)
  const styleDuringTake = useRef(false)
  const playback = useRef<Playback | null>(null)
  const live = useRef<Sink | null>(null)

  const profileId = profile?.id ?? null
  useEffect(() => {
    if (profileId) void repo.list(profileId).then(setTakes)
  }, [repo, profileId])
  useEffect(() => {
    void store.get<number>(COUNT_IN_KEY).then((v) => typeof v === 'number' && setCountIn(v))
  }, [store])
  const chooseCountIn = (v: number) => {
    setCountIn(v)
    void store.set(COUNT_IN_KEY, v)
  }
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
    if (!('time' in e) || e.time >= recordFrom.current) recorder.current?.feed(e)
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
    const bpm = takeBpm.current
    setPending({ ...r, style, ...(bpm ? { bpm } : {}) })
    if (profileId)
      void log.add(profileId, {
        type: 'studio_recorded',
        ms: r.ms,
        notes: r.notes.length,
        style,
        ...(songId ? { songId } : {}),
        ...(bpm ? { countIn: bpm } : {}),
      })
  }, [t, profileId, log, songId])

  const cancelCountIn = useCallback(() => {
    countingIn.current?.()
    countingIn.current = null
    recorder.current = null
    setCounting(null)
  }, [])
  useEffect(() => () => countingIn.current?.(), [])

  const startRecording = () => {
    stopPlayback()
    setPending(null)
    setMessage(null)
    setSaved(null)
    styleDuringTake.current = styleOn.current
    if (!countIn) {
      recordStart.current = performance.now()
      recordFrom.current = -Infinity
      takeBpm.current = undefined
      recorder.current = new Recorder(recordStart.current)
      setRecording({ ms: 0, count: 0 })
      return
    }
    // Four clicks, and the take starts on the fifth beat. The recorder is ready
    // from now, so a downbeat played a hair early still lands at 0:00.
    const beat = 60_000 / countIn
    const clicks: Recording = {
      ms: BEATS * beat,
      notes: Array.from({ length: BEATS }, (_, i) => ({ pitch: CLICK, velocity: i === 0 ? 110 : 70, startMs: Math.round(i * beat), durationMs: 120 })),
      pedal: [],
    }
    const p = new Playback(clicks, output.sink(), realClock)
    p.start()
    const startAt = p.startedAt + BEATS * beat
    recordStart.current = startAt
    recordFrom.current = startAt - beat / 2
    takeBpm.current = countIn
    recorder.current = new Recorder(startAt)
    setCounting(BEATS)
    const id = setInterval(() => {
      const now = performance.now()
      if (now < startAt) return setCounting(Math.max(1, BEATS - Math.max(0, Math.floor((now - p.startedAt) / beat))))
      clearInterval(id)
      countingIn.current = null
      setCounting(null)
      setRecording({ ms: now - startAt, count: recorder.current?.noteCount ?? 0 })
    }, 20)
    countingIn.current = () => {
      clearInterval(id)
      p.stop()
    }
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
    const { bpm, ...notes } = r
    const take = await repo.keep(profileId, notes, {
      style,
      ...(bpm ? { bpm } : {}),
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
  const toggleOpen = (take: Take) => {
    setSure(null)
    setSaved(null)
    setDraft(take.name ?? '')
    setOpen((o) => (o === take.id ? null : take.id))
  }
  const rename = async (take: Take) => {
    if (!profileId) return
    await repo.rename(profileId, take.id, draft)
    setTakes(await repo.list(profileId))
    setOpen(null)
    void log.add(profileId, { type: 'studio_renamed', takeId: take.id })
  }
  const exportTake = async (take: Take) => {
    const name = nameOf(take)
    const bytes = takeToSmf(take, { name, ...(take.bpm ? { bpm: take.bpm } : {}) })
    const file = new File([bytes as BlobPart], midiFilename(name), { type: 'audio/midi' })
    const outcome = await saveFile(file, name)
    if (outcome === 'saved') setSaved({ id: take.id, text: t('studioMidiSaved', { file: file.name }) })
    if (outcome === 'error') setSaved({ id: take.id, text: t('studioMidiError') })
    if (profileId) void log.add(profileId, { type: 'studio_exported', takeId: take.id, outcome })
  }
  const remove = async (take: Take) => {
    if (!profileId) return
    if (sure !== take.id) return setSure(take.id)
    if (playingId === take.id) stopPlayback()
    await repo.remove(profileId, take.id)
    setSure(null)
    setOpen(null)
    setTakes(await repo.list(profileId))
    void log.add(profileId, { type: 'studio_deleted', takeId: take.id })
  }

  // The screen's own keys play too: on the keyboard or the phone, and into the take.
  const screenPress = (p: number) => {
    live.current ??= output.sink()
    live.current.noteOn(p, 80, performance.now())
    if (performance.now() >= recordFrom.current) recorder.current?.noteOn(p, 80, performance.now())
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

  const wide = useWide()
  const boxes = useMemo(() => {
    const r = wide ? widenRange({ low: LOW, high: HIGH }, WIDE_OCTAVES) : { low: LOW, high: HIGH }
    return keyBoxes(r.low, r.high)
  }, [wide])
  const tune = useMemo(() => {
    if (!song) return null
    const bars = new Map<number, string[]>()
    for (const n of song.notes.filter((x) => x.hand === 'right')) {
      if (n.bar >= 8) break
      bars.set(n.bar, [...(bars.get(n.bar) ?? []), label(n.pitch)])
    }
    return [...bars.values()].map((b) => b.join(' ')).join('  |  ')
  }, [song, label])

  const numbered = (take: Take) => (take.songTitle ? t('studioTakeOf', { title: take.songTitle, n: take.n }) : t('studioTakeN', { n: take.n }))
  const nameOf = (take: Take) => take.name ?? numbered(take)

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
          <button
            type="button"
            className={styles.record}
            data-recording={recording || counting !== null ? true : undefined}
            onClick={counting !== null ? cancelCountIn : recording ? stopRecording : startRecording}
          >
            {counting !== null ? t('studioCancel') : recording ? t('studioStop') : t('studioRecord')}
          </button>
          {counting !== null && (
            <span key={counting} className={styles.countIn} role="status">
              {t('studioCountingIn', { n: counting })}
            </span>
          )}
          {recording && (
            <span className={styles.recordStatus}>
              {t('studioRecording', {
                time: clock(recording.ms),
                count: recording.count,
              })}
            </span>
          )}
        </div>
        {!recording && counting === null && (
          <div className={styles.via}>
            <span className={styles.hint}>{t('studioCountIn')}</span>
            <SegmentedControl
              size="sm"
              value={String(countIn)}
              onChange={(v) => chooseCountIn(Number(v))}
              options={COUNT_INS.map((b) => ({ value: String(b), label: b ? String(b) : t('studioCountInOff') }))}
            />
          </div>
        )}
        {countIn > 0 && !recording && counting === null && <p className={styles.hint}>{t('studioCountInHint', { bpm: countIn })}</p>}
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
              <button type="button" className={styles.more} aria-expanded={open === take.id} aria-label={t('studioMore', { name: nameOf(take) })} onClick={() => toggleOpen(take)}>
                ⋯
              </button>
              {open === take.id && (
                <div className={styles.takeMore}>
                  <form
                    className={styles.renameRow}
                    onSubmit={(e) => {
                      e.preventDefault()
                      void rename(take)
                    }}
                  >
                    <Field label={t('studioName')} value={draft} placeholder={numbered(take)} maxLength={MAX_NAME} onChange={(e) => setDraft(e.target.value)} />
                    <Button type="submit" size="sm">
                      {t('studioSaveName')}
                    </Button>
                  </form>
                  <div className={styles.actions}>
                    <Button size="sm" variant="outline" onClick={() => void exportTake(take)}>
                      {t('studioSaveMidi')}
                    </Button>
                    <Button size="sm" variant={sure === take.id ? 'danger' : 'ghost'} onClick={() => void remove(take)}>
                      {sure === take.id ? t('studioSure') : t('studioDelete')}
                    </Button>
                  </div>
                  {saved?.id === take.id && <p className={styles.hint}>{saved.text}</p>}
                  <p className={styles.hint}>{take.bpm ? t('studioMidiBars', { bpm: take.bpm }) : t('studioMidiNoBars')}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
