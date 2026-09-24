import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, SegmentedControl } from '../../../ds'
import { buildReport, cueFor, Judge, MIN_VELOCITY, notesFor, octaveShift, type JudgeEvent, type NoteResult, type Practice, type Report, type Song } from '../../engine'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { useApp } from '../context'
import { noteLabel } from '../i18n'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { FallingNotes, type FallingNotesHandle } from './FallingNotes'
import { keyBoxes, rangeFor } from './keyGeometry'
import { SongLibrary } from './library'
import { PlayKeyboard } from './PlayKeyboard'
import { ReportView } from './ReportView'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import styles from './songs.module.css'

type Phase = 'setup' | 'ready' | 'playing' | 'paused' | 'report'

const SPEEDS = ['1', '0.75', '0.5'] as const
const MIDDLE_C = 60
/** How long a wrong key stays red. */
const WRONG_FLASH_MS = 350
/** Before the start, the first notes rest this far (song ms) above the hit line. */
const READY_TIME = -1500

export function PlayScreen({ songId }: { songId: string }) {
  const { t, store, settings, profile, log } = useApp()
  const library = useMemo(() => new SongLibrary(store), [store])
  const [song, setSong] = useState<Song | null | undefined>(undefined)
  useEffect(() => {
    void library.get(songId, settings.language).then(setSong)
  }, [library, songId, settings.language])
  // A song that isn't on this phone (an old link, a restored backup without it): back to the list.
  useEffect(() => {
    if (song === null) navigate({ name: 'door', door: 'songs' }, { replace: true })
  }, [song])

  if (!song) return null
  return <Player song={song} key={song.id} t={t} settings={settings} profileId={profile?.id ?? null} log={log} />
}

type PlayerProps = {
  song: Song
  t: ReturnType<typeof useApp>['t']
  settings: ReturnType<typeof useApp>['settings']
  profileId: string | null
  log: ReturnType<typeof useApp>['log']
}

function Player({ song, t, settings, profileId, log }: PlayerProps) {
  const hasLeft = song.notes.some((n) => n.hand === 'left')
  const [practice, setPractice] = useState<Practice>('right')
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>('1')
  const [phase, setPhase] = useState<Phase>('setup')
  const [pauseReason, setPauseReason] = useState<'disconnected' | 'hidden' | null>(null)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [wrong, setWrong] = useState<ReadonlySet<number>>(new Set())
  const [targets, setTargets] = useState<ReadonlySet<number>>(new Set())
  const [results, setResults] = useState<ReadonlyMap<number, NoteResult['outcome']>>(new Map())
  const [hint, setHint] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [countIn, setCountIn] = useState<number | null>(null)

  const judge = useRef<Judge | null>(null)
  /** The octave shift found by the middle-C check; applies to the Yamaha only, never to on-screen keys. */
  const shift = useRef(0)
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase
  const fall = useRef<FallingNotesHandle>(null)
  const shownTime = useRef(0)

  const notes = useMemo(() => notesFor(song, practice), [song, practice])
  const range = useMemo(() => rangeFor(song.notes.map((n) => n.pitch)), [song])
  const boxes = useMemo(() => keyBoxes(range.low, range.high), [range])
  const label = useCallback((p: number) => noteLabel(p, settings.noteNames, settings.language), [settings.noteNames, settings.language])
  const tempo = Number(speed)

  const finish = useCallback(() => {
    const j = judge.current
    if (!j) return
    const r = buildReport(j.summary(), settings)
    setReport(r)
    setPhase('report')
    if (profileId) void log.add(profileId, { type: 'song_finished', songId: song.id, practice, stars: r.stars, score: Math.round(r.score * 100) / 100, hit: r.hit, total: r.total, wrong: r.wrong })
  }, [settings, profileId, log, song.id, practice])

  const apply = useCallback(
    (events: JudgeEvent[]) => {
      if (events.length === 0) return
      const outcomes: [number, NoteResult['outcome']][] = []
      for (const e of events) {
        const cue = cueFor(e, settings)
        if (cue?.flashWrong !== undefined) {
          const p = cue.flashWrong
          setWrong((w) => new Set(w).add(p))
          setTimeout(() => setWrong((w) => { const n = new Set(w); n.delete(p); return n }), WRONG_FLASH_MS)
        }
        if (e.type === 'hit' || e.type === 'missed') outcomes.push([e.result.note.id, e.result.outcome])
      }
      if (outcomes.length) setResults((r) => new Map([...r, ...outcomes]))
      if (events.some((e) => e.type === 'done')) finish()
    },
    [settings, finish],
  )

  /** Start after the middle-C check: the key pressed tells us the keyboard's octave shift. */
  const begin = useCallback(
    (pitch: number, at: number, fromScreen: boolean) => {
      // On-screen keys are exact, so only middle C itself starts from there.
      const found = fromScreen ? (pitch === MIDDLE_C ? 0 : null) : octaveShift(pitch, MIDDLE_C)
      if (found === null) {
        setHint(t('notAC', { note: label(pitch) }))
        return
      }
      setHint(null)
      shift.current = found
      const j = new Judge(song, { practice, settings, tempo, shift: found })
      judge.current = j
      if (j.mode === 'running') {
        // Three beats of lead-in: the first notes are already falling.
        const leadIn = (3 * 60000) / song.bpm / tempo
        j.start(at + leadIn)
      }
      shownTime.current = READY_TIME
      setResults(new Map())
      setPhase('playing')
      if (profileId) void log.add(profileId, { type: 'song_started', songId: song.id, practice, tempo, mode: j.mode })
    },
    [song, practice, settings, tempo, t, label, profileId, log],
  )

  /**
   * One key down, from the Yamaha (raw pitch; the judge adds the octave shift)
   * or from the screen (already the pitch drawn, so the shift is taken back out).
   */
  const press = useCallback(
    (pitch: number, at: number, fromScreen: boolean) => {
      const drawn = fromScreen ? pitch : pitch + shift.current
      setHeld((h) => new Set(h).add(drawn))
      if (phaseRef.current === 'ready') begin(pitch, at, fromScreen)
      else if (phaseRef.current === 'playing' && judge.current) apply(judge.current.press(fromScreen ? pitch - shift.current : pitch, at))
    },
    [begin, apply],
  )
  const release = useCallback((drawn: number) => {
    setHeld((h) => {
      const n = new Set(h)
      n.delete(drawn)
      return n
    })
  }, [])

  // The Yamaha: player channels only (accompaniment never counts), grazed keys ignored.
  const onMidi = useCallback(
    (e: MidiEvent) => {
      if ((e.type !== 'noteon' && e.type !== 'noteoff') || !isPlayerChannel(e.channel)) return
      if (e.type === 'noteoff') return release(e.note + shift.current)
      if (e.velocity < MIN_VELOCITY) return
      press(e.note, e.time, false)
    },
    [press, release],
  )
  const keyboard = useKeyboard(onMidi)

  // Pause when the keyboard disappears or KeyPath leaves the screen; never count those as misses.
  const pause = useCallback((reason: 'disconnected' | 'hidden') => {
    if (phaseRef.current !== 'playing' || judge.current?.mode !== 'running') return
    judge.current.pause(performance.now())
    setPauseReason(reason)
    setPhase('paused')
    if (reason === 'disconnected' && profileId) void log.add(profileId, { type: 'keyboard_lost', songId: song.id })
  }, [profileId, log, song.id])
  const wasConnected = useRef(keyboard.connected)
  useEffect(() => {
    if (wasConnected.current && !keyboard.connected) {
      pause('disconnected')
      // Its Note Offs will never come: let go of every key it was holding.
      setHeld(new Set())
    }
    wasConnected.current = keyboard.connected
  }, [keyboard.connected, pause])
  useEffect(() => {
    const onVis = () => document.visibilityState === 'hidden' && pause('hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pause])

  // One loop per frame: judge the clock, move the notes, mark the next keys.
  useEffect(() => {
    if (phase !== 'playing') return
    let raf = 0
    let lastTargets = ''
    const frame = () => {
      const j = judge.current
      if (!j) return
      const now = performance.now()
      let target: number
      let next: number[]
      if (j.mode === 'running') {
        apply(j.tick(now))
        target = j.songTime(now)
        shownTime.current = target
        const s = j.songTime(now)
        setCountIn(s < 0 ? Math.ceil(-s / (60000 / song.bpm)) : null)
        next = notes.filter((n) => n.startMs >= s - 150 && n.startMs <= s + 450 && !results.has(n.id)).map((n) => n.pitch)
      } else {
        const step = j.currentStep
        target = step?.startMs ?? shownTime.current
        // Glide to the waiting step rather than jumping.
        shownTime.current += (target - shownTime.current) * 0.2
        next = step ? step.notes.map((n) => n.pitch) : []
      }
      fall.current?.setTime(shownTime.current)
      const key = next.sort((a, b) => a - b).join(',')
      if (key !== lastTargets) {
        lastTargets = key
        setTargets(new Set(next))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, apply, notes, results, song.bpm])

  // Before playing, show the start of the song resting at the top.
  useEffect(() => {
    if (phase === 'setup' || phase === 'ready') fall.current?.setTime(READY_TIME)
  }, [phase, notes])

  const stop = () => {
    const j = judge.current
    if (j && profileId && phaseRef.current !== 'report') {
      const s = j.summary()
      void log.add(profileId, { type: 'song_abandoned', songId: song.id, practice, hit: s.results.filter((r) => r.outcome === 'hit').length, total: s.total })
    }
    judge.current = null
    setPhase('setup')
    setResults(new Map())
    setCountIn(null)
  }

  const carryOn = () => {
    judge.current?.resume(performance.now())
    setPauseReason(null)
    setPhase('playing')
  }

  const playAgain = () => {
    judge.current = null
    setReport(null)
    setResults(new Map())
    setPhase('ready')
  }

  if (phase === 'report' && report) {
    return (
      <main className={styles.screen}>
        <TopBar title={song.title} />
        <ReportView report={report} songId={song.id} onPlayAgain={playAgain} onAnotherSong={() => history.back()} onMakeItYours={() => navigate({ name: 'studio', songId: song.id })} />
      </main>
    )
  }

  return (
    <main className={styles.playScreen}>
      <TopBar title={song.title} />
      <div className={styles.connection}>
        <KeyboardStatus status={keyboard} missing="keyboardMissing" />
      </div>

      {phase === 'setup' && (
        <section className={styles.panel}>
          {hasLeft && (
            <div className={styles.row}>
              <span className={styles.label}>{t('hands')}</span>
              <SegmentedControl
                value={practice}
                onChange={(v) => setPractice(v as Practice)}
                options={[
                  { value: 'right', label: t('handRight') },
                  { value: 'left', label: t('handLeft') },
                  { value: 'both', label: t('handBoth') },
                ]}
              />
            </div>
          )}
          <div className={styles.row}>
            <span className={styles.label}>{t('speed')}</span>
            <SegmentedControl value={speed} onChange={(v) => setSpeed(v as (typeof SPEEDS)[number])} options={SPEEDS.map((s) => ({ value: s, label: `${Math.round(Number(s) * 100)}%` }))} />
          </div>
          <div>
            <Button onClick={() => setPhase('ready')}>▶ {t('startSong')}</Button>
          </div>
        </section>
      )}

      {phase === 'ready' && (
        <div className={styles.prompt} role="status">
          <strong>{t('pressMiddleC')}</strong>
          <span>{hint ?? t('pressMiddleCHint')}</span>
        </div>
      )}

      {phase === 'paused' && (
        <div className={styles.prompt} role="status">
          <strong>{t('paused')}</strong>
          {pauseReason === 'disconnected' && <span>{keyboard.connected ? t('keyboardBack') : t('pausedDisconnected')}</span>}
          <div className={styles.actions}>
            {pauseReason === 'disconnected' && !keyboard.connected ? (
              <>
                <Button onClick={() => navigate({ name: 'connect' })}>{t('helpReconnect')}</Button>
                <Button variant="outline" onClick={carryOn}>
                  {t('carryOn')}
                </Button>
              </>
            ) : (
              <Button onClick={carryOn}>{t('carryOn')}</Button>
            )}
            <Button variant="ghost" onClick={stop}>
              {t('stop')}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.stage}>
        {countIn !== null && phase === 'playing' && <div className={styles.countIn}>{countIn}</div>}
        <FallingNotes ref={fall} notes={notes} boxes={boxes} results={results} label={label} />
        <PlayKeyboard
          names={settings.keyNames}
          boxes={boxes}
          held={held}
          targets={phase === 'ready' ? new Set([MIDDLE_C]) : targets}
          wrong={wrong}
          marker={phase === 'ready' ? MIDDLE_C : undefined}
          label={label}
          onPress={(p) => press(p, performance.now(), true)}
          onRelease={release}
        />
      </div>

      {phase === 'playing' && (
        <div className={styles.actions}>
          <Button variant="ghost" onClick={stop}>
            {t('stop')}
          </Button>
        </div>
      )}
    </main>
  )
}
