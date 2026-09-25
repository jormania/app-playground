import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, SegmentedControl } from '../../../ds'
import { buildReport, cueFor, Judge, MIN_VELOCITY, notesFor, octaveShift, type JudgeEvent, type JudgeSettings, type NoteResult, type OnWrong, type Practice, type Report, type Song, type Timing } from '../../engine'
import type { StringKey } from '../i18n'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { celebrate } from '../celebrate/celebrate'
import { useApp } from '../context'
import { noteLabel } from '../i18n'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { FallingNotes, type FallingNotesHandle } from './FallingNotes'
import { keyBoxes, rangeFor, widenRange } from './keyGeometry'
import { useWide, WIDE_OCTAVES } from './useWide'
import { SongLibrary } from './library'
import { PlayKeyboard } from './PlayKeyboard'
import { ReportView } from './ReportView'
import { afterPass, barSong, isClean, startLoop, tempoOf, type Loop, type LoopStep } from './loop'
import { nextStep, partPassed, PartsRepo, partSteps, rangeSong, type PartStep } from './parts'
import { tryNext } from './level'
import { songProgress } from './songProgress'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { useOutput } from '../studio/output'
import { Playback, realClock } from '../studio/playback'
import styles from './songs.module.css'
import setup from '../setup.module.css'

type Phase = 'setup' | 'ready' | 'playing' | 'paused' | 'report' | 'loopBreak' | 'loopDone' | 'partDone'

const SPEEDS = ['1', '0.75', '0.5'] as const
const ON_WRONG_LABEL: Record<OnWrong, StringKey> = { keepGoing: 'onWrongKeepGoing', show: 'onWrongShow', wait: 'onWrongWait' }
const TIMING_LABEL: Record<Timing, StringKey> = { relaxed: 'timingRelaxed', normal: 'timingNormal', strict: 'timingStrict' }
const MIDDLE_C = 60
/** How long a wrong key stays red. */
const WRONG_FLASH_MS = 350
/** The streak counter appears from this many right notes in a row. */
const STREAK_SHOWN = 5
/** Before the start, the first notes rest this far (song ms) above the hit line. */
const READY_TIME = -1500
/** Between two passes of a practised bar: long enough to read how it went. */
const LOOP_BREAK_MS = 1600

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
  return <Player song={song} key={song.id} t={t} settings={settings} profileId={profile?.id ?? null} log={log} store={store} />
}

type PlayerProps = {
  song: Song
  t: ReturnType<typeof useApp>['t']
  settings: ReturnType<typeof useApp>['settings']
  profileId: string | null
  log: ReturnType<typeof useApp>['log']
  store: ReturnType<typeof useApp>['store']
}

function Player({ song, t, settings, profileId, log, store }: PlayerProps) {
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
  const [streak, setStreak] = useState(0)
  // Practising one bar from the report: the loop, and what the last pass came to.
  const [loop, setLoop] = useState<Loop | null>(null)
  const [loopStep, setLoopStep] = useState<LoopStep | null>(null)
  const loopRef = useRef<Loop | null>(null)
  const loopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Learning it in parts: the way through (phrases, joins, the whole song), what
  // she has learnt, and the part chosen, which starts as the first not learnt.
  const partsRepo = useMemo(() => new PartsRepo(store), [store])
  const steps = useMemo(() => partSteps(song, practice), [song, practice])
  const [learnt, setLearnt] = useState<ReadonlySet<string>>(new Set())
  const [partId, setPartId] = useState<string | null>(null)
  const [partResult, setPartResult] = useState<{ passed: boolean; wrong: number } | null>(null)
  useEffect(() => {
    let live = true
    void (profileId ? partsRepo.get(profileId, song.id, practice) : Promise.resolve(new Set<string>())).then((l) => {
      if (!live) return
      setLearnt(l)
      setPartId(nextStep(steps, l)?.id ?? null)
    })
    return () => {
      live = false
    }
  }, [partsRepo, profileId, song.id, practice, steps])
  // "Try next" on the report: the easiest song she hasn't finished yet.
  const [next, setNext] = useState<{ id: string; title: string } | null>(null)
  useEffect(() => {
    if (phase !== 'report' || !profileId) return
    let live = true
    void (async () => {
      const [entries, records] = await Promise.all([new SongLibrary(store).list(settings.language), log.read(profileId)])
      const done = songProgress(records)
      const pick = tryNext(entries, (id) => id === song.id || done.get(id)?.bestStars != null, song.id)
      if (live) setNext(pick ? { id: pick.song.id, title: pick.song.title } : null)
    })()
    return () => {
      live = false
    }
  }, [phase, profileId, store, settings.language, log, song.id])
  const part = steps.find((x) => x.id === partId) ?? null
  /** A part short of the whole song: played on its own, always in "Wait for it". */
  const span = part && part.kind !== 'whole' ? part : null
  /** The middle-C check is done once per visit; the next part starts straight away. */
  const shiftKnown = useRef(false)

  const judge = useRef<Judge | null>(null)
  /** The octave shift found by the middle-C check; applies to the Yamaha only, never to on-screen keys. */
  const shift = useRef(0)
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase
  const fall = useRef<FallingNotesHandle>(null)
  const shownTime = useRef(0)

  // What's being played: the song, one part of it, or the one bar being practised.
  const loopBar = loop?.bar ?? null
  const spanFrom = span?.from ?? null
  const spanTo = span?.to ?? null
  const playing = useMemo(() => {
    if (loopBar !== null) return barSong(song, loopBar) ?? song
    if (spanFrom !== null && spanTo !== null) return rangeSong(song, spanFrom, spanTo) ?? song
    return song
  }, [song, loopBar, spanFrom, spanTo])
  const playSettings = useMemo((): typeof settings => (spanFrom !== null ? { ...settings, onWrong: 'wait' } : settings), [settings, spanFrom])
  const notes = useMemo(() => notesFor(playing, practice), [playing, practice])
  const songNotes = useMemo(() => notesFor(song, practice), [song, practice])
  const wide = useWide()
  // The keys the chosen hands need, not the whole song: right hand alone on a
  // phone gets keys a finger can hit, instead of three octaves of slivers. A
  // practised bar keeps the song's keys, so nothing moves under her hands.
  const range = useMemo(() => {
    const r = rangeFor(songNotes.map((n) => n.pitch))
    return wide ? widenRange(r, WIDE_OCTAVES) : r
  }, [songNotes, wide])
  const boxes = useMemo(() => keyBoxes(range.low, range.high), [range])
  const label = useCallback((p: number) => noteLabel(p, settings.noteNames, settings.language), [settings.noteNames, settings.language])
  const tempo = Number(speed)

  const setLoopBoth = (l: Loop | null) => {
    loopRef.current = l
    setLoop(l)
  }
  /** One pass of the practised bar: its own judge, at the loop's tempo, with a count-in when there's a clock. */
  const startPass = useCallback(
    (l: Loop) => {
      const bar = barSong(song, l.bar)
      if (!bar) return
      const j = new Judge(bar, { practice, settings, tempo: tempoOf(l), shift: shift.current })
      judge.current = j
      if (j.mode === 'running') j.start(performance.now() + (3 * 60000) / song.bpm / tempoOf(l))
      shownTime.current = READY_TIME
      setResults(new Map())
      setStreak(0)
      setPhase('playing')
    },
    [song, practice, settings],
  )
  /** The loop is over: finished clean, or left. Logged once, with how far it got. */
  const endLoop = useCallback(
    (done: boolean) => {
      const l = loopRef.current
      if (!l) return
      clearTimeout(loopTimer.current)
      if (profileId) void log.add(profileId, { type: 'song_loop', songId: song.id, practice, bar: l.bar + 1, passes: l.passes, done, tempo: tempoOf(l) })
      loopRef.current = null
    },
    [profileId, log, song.id, practice],
  )

  const finish = useCallback(() => {
    const j = judge.current
    if (!j) return
    const l = loopRef.current
    if (l) {
      const { loop: next, step } = afterPass(l, isClean(j.summary()))
      setLoopBoth(next)
      setLoopStep(step)
      if (step === 'done') {
        endLoop(true)
        celebrate('stepPassed')
        setPhase('loopDone')
      } else {
        setPhase('loopBreak')
        loopTimer.current = setTimeout(() => startPass(next), LOOP_BREAK_MS)
      }
      return
    }
    const summary = j.summary()
    if (part) {
      const passed = partPassed(summary)
      if (profileId) {
        void log.add(profileId, { type: 'song_part', songId: song.id, practice, part: part.id, passed, wrong: summary.wrong.length })
        if (passed) void partsRepo.pass(profileId, song.id, practice, part.id).then(setLearnt)
      }
      if (part.kind !== 'whole') {
        setPartResult({ passed, wrong: summary.wrong.length })
        setPhase('partDone')
        if (passed) celebrate('stepPassed')
        return
      }
    }
    const r = buildReport(summary, settings)
    setReport(r)
    setPhase('report')
    if (profileId) void log.add(profileId, { type: 'song_finished', songId: song.id, practice, stars: r.stars, score: Math.round(r.score * 100) / 100, hit: r.hit, total: r.total, wrong: r.wrong })
  }, [settings, profileId, log, song.id, practice, endLoop, startPass, part, partsRepo])

  const apply = useCallback(
    (events: JudgeEvent[]) => {
      if (events.length === 0) return
      const outcomes: [number, NoteResult['outcome']][] = []
      for (const e of events) {
        const cue = cueFor(e, playSettings)
        if (cue?.flashWrong !== undefined) {
          const p = cue.flashWrong
          setWrong((w) => new Set(w).add(p))
          setTimeout(() => setWrong((w) => { const n = new Set(w); n.delete(p); return n }), WRONG_FLASH_MS)
        }
        if (e.type === 'hit' || e.type === 'missed') outcomes.push([e.result.note.id, e.result.outcome])
        // The streak: right notes in a row; a wrong or missed note starts it again, quietly.
        if (e.type === 'hit') setStreak((n) => n + 1)
        if (e.type === 'wrong' || e.type === 'missed') setStreak(0)
      }
      if (outcomes.length) setResults((r) => new Map([...r, ...outcomes]))
      if (events.some((e) => e.type === 'done')) finish()
    },
    [playSettings, finish],
  )

  /** Judge from now: the song, or its part, as chosen. */
  const startJudge = useCallback(
    (target: Song, js: JudgeSettings, at: number, partOf: PartStep | null) => {
      const j = new Judge(target, { practice, settings: js, tempo, shift: shift.current })
      judge.current = j
      if (j.mode === 'running') {
        // Three beats of lead-in: the first notes are already falling.
        const leadIn = (3 * 60000) / song.bpm / tempo
        j.start(at + leadIn)
      }
      shownTime.current = READY_TIME
      setResults(new Map())
      setStreak(0)
      setPartResult(null)
      setPhase('playing')
      if (profileId) void log.add(profileId, { type: 'song_started', songId: song.id, practice, tempo, mode: j.mode, ...(partOf ? { part: partOf.id } : {}) })
    },
    [song, practice, tempo, profileId, log],
  )

  /** Straight into a part (from "Next" or "Again"): no middle C again once it's known. */
  const startPart = (step: PartStep) => {
    setPartId(step.id)
    const target = step.kind === 'whole' ? song : (rangeSong(song, step.from, step.to) ?? song)
    const js: JudgeSettings = step.kind === 'whole' ? settings : { ...settings, onWrong: 'wait' }
    if (shiftKnown.current) startJudge(target, js, performance.now(), step)
    else setPhase('ready')
  }

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
      shiftKnown.current = true
      startJudge(playing, playSettings, at, part)
    },
    [t, label, startJudge, playing, playSettings, part],
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

  // Listen first: the song played for her (on the keyboard, or the phone) at the
  // chosen hands and speed, the notes falling and their keys lighting as it goes.
  const output = useOutput(keyboard)
  const [listening, setListening] = useState(false)
  const [listenKeys, setListenKeys] = useState<ReadonlySet<number>>(new Set())
  const listenPlayback = useRef<Playback | null>(null)
  const stopListening = useCallback(() => {
    listenPlayback.current?.stop()
    listenPlayback.current = null
    setListening(false)
    setListenKeys(new Set())
    fall.current?.setTime(READY_TIME)
  }, [])
  const listen = () => {
    if (listening) return stopListening()
    const take = {
      ms: Math.round(playing.durationMs / tempo) + 300,
      notes: notes.map((n) => ({ pitch: n.pitch, velocity: 80, startMs: Math.round(n.startMs / tempo), durationMs: Math.round(n.durationMs / tempo) })),
      pedal: [],
    }
    const p = new Playback(take, output.sink(), realClock, stopListening)
    listenPlayback.current = p
    p.start()
    setListening(true)
    if (profileId) void log.add(profileId, { type: 'song_listened', songId: song.id, practice, tempo })
  }
  useEffect(() => {
    if (!listening) return
    let raf = 0
    let lastKeys = ''
    const frame = () => {
      const p = listenPlayback.current
      if (!p) return
      const s = p.position() * tempo
      fall.current?.setTime(s)
      const sounding = notes.filter((n) => n.startMs <= s && s < n.startMs + n.durationMs).map((n) => n.pitch)
      const key = sounding.join(',')
      if (key !== lastKeys) {
        lastKeys = key
        setListenKeys(new Set(sounding))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [listening, notes, tempo])
  useEffect(() => () => listenPlayback.current?.stop(), [])

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

  // Leaving mid-song (the back arrow, the phone's back) counts as stopping it, as the Stop button does.
  const practiceRef = useRef(practice)
  practiceRef.current = practice
  const endLoopRef = useRef(endLoop)
  endLoopRef.current = endLoop
  useEffect(
    () => () => {
      if (loopRef.current) return endLoopRef.current(false)
      const j = judge.current
      if (!j || !profileId || (phaseRef.current !== 'playing' && phaseRef.current !== 'paused')) return
      const s = j.summary()
      void log.add(profileId, { type: 'song_abandoned', songId: song.id, practice: practiceRef.current, hit: s.results.filter((r) => r.outcome === 'hit').length, total: s.total })
    },
    [log, profileId, song.id],
  )

  const stop = () => {
    // Stopping a practised bar goes back to the report it came from.
    if (loopRef.current) return backToReport()
    const j = judge.current
    if (j && profileId && phaseRef.current !== 'report') {
      const s = j.summary()
      void log.add(profileId, { type: 'song_abandoned', songId: song.id, practice, hit: s.results.filter((r) => r.outcome === 'hit').length, total: s.total })
    }
    judge.current = null
    setPhase('setup')
    setResults(new Map())
    setStreak(0)
    setCountIn(null)
  }

  const carryOn = () => {
    judge.current?.resume(performance.now())
    setPauseReason(null)
    setPhase('playing')
  }

  const practiseBar = (bar: number) => {
    const l = startLoop(bar, settings.onWrong === 'wait' ? 'wait' : 'running', tempo)
    setLoopBoth(l)
    setLoopStep(null)
    startPass(l)
  }
  const backToReport = () => {
    endLoop(false)
    setLoopBoth(null)
    judge.current = null
    setCountIn(null)
    setPhase('report')
  }
  const wholeSong = () => {
    setLoopBoth(null)
    playAgain()
  }

  const playAgain = () => {
    judge.current = null
    setReport(null)
    setResults(new Map())
    setStreak(0)
    setPhase('ready')
  }

  const partName = (x: PartStep) => (x.kind === 'phrase' ? t('partPhrase', { n: x.first }) : x.kind === 'join' ? t('partJoin', { a: x.first, b: x.last }) : t('partWhole'))
  const chipName = (x: PartStep) => (x.kind === 'phrase' ? String(x.first) : x.kind === 'join' ? `${x.first}–${x.last}` : t('partWholeShort'))
  const afterPart = part ? (steps[steps.indexOf(part) + 1] ?? null) : null

  if (phase === 'report' && report) {
    return (
      <main className={styles.screen}>
        <TopBar title={song.title} />
        <ReportView report={report} songId={song.id} onPlayAgain={playAgain} onPractiseBar={practiseBar} next={next && { title: next.title, onOpen: () => navigate({ name: 'play', songId: next.id }) }} onAnotherSong={() => navigate({ name: 'door', door: 'songs' })} onMakeItYours={() => navigate({ name: 'studio', songId: song.id })} />
      </main>
    )
  }

  return (
    <main className={styles.playScreen}>
      <TopBar title={song.title} aside={<KeyboardStatus status={keyboard} missing="keyboardMissing" />} />

      {phase === 'setup' && (
        <section className={setup.bar}>
          {hasLeft && (
            <div className={setup.field}>
              <span className={setup.label}>{t('hands')}</span>
              <SegmentedControl
                size="sm"
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
          {steps.length > 0 && (
            <div className={setup.field}>
              <span className={setup.label}>{t('parts')}</span>
              <div className={setup.chips} role="group" aria-label={t('parts')}>
                {steps.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={setup.chip}
                    aria-pressed={x.id === partId}
                    aria-label={`${partName(x)}${learnt.has(x.id) ? ` · ${t('partLearntShort')}` : ''}`}
                    onClick={() => setPartId(x.id)}
                  >
                    {chipName(x)}
                    {learnt.has(x.id) && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={setup.field}>
            <span className={setup.label}>{t('speed')}</span>
            <SegmentedControl size="sm" value={speed} onChange={(v) => setSpeed(v as (typeof SPEEDS)[number])} options={SPEEDS.map((s) => ({ value: s, label: `${Math.round(Number(s) * 100)}%` }))} />
          </div>
          <div className={setup.go}>
            <Button
              onClick={() => {
                stopListening()
                setPhase('ready')
              }}
            >
              ▶ {span ? partName(span) : t('startSong')}
            </Button>
            <Button variant="outline" onClick={listen}>
              {listening ? `■ ${t('stop')}` : `🎧 ${t('listen')}`}
            </Button>
          </div>
          {span ? (
            <p className={setup.note} data-inline>
              {t('partMode', { from: span.from + 1, to: span.to })}
            </p>
          ) : (
            <p className={setup.note} data-inline>
              <span>{t('playMode', { mode: t(ON_WRONG_LABEL[settings.onWrong]), timing: t(TIMING_LABEL[settings.timing]) })}</span>
              <button type="button" className={setup.link} onClick={() => navigate({ name: 'settings' })}>
                {t('playModeChange')}
              </button>
            </p>
          )}
          {output.phoneMuted && <p className={setup.note}>{t('studioPhoneMuted')}</p>}
        </section>
      )}

      {phase === 'ready' && (
        <div className={styles.prompt} role="status">
          <strong>{t('pressMiddleC')}</strong>
          <span>{hint ?? t('pressMiddleCHint')}</span>
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={() => setPhase('setup')}>
              {t(hasLeft ? 'backToSetupHands' : 'backToSetupSpeed')}
            </Button>
          </div>
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

      {loop && phase === 'playing' && (
        <div className={styles.prompt} role="status">
          <strong>
            🔁 {t('loopBar', { bar: loop.bar + 1 })}
            {settings.onWrong !== 'wait' && ` · ${Math.round(tempoOf(loop) * 100)}%`}
          </strong>
          <span>
            {loopStep === null && loop.rungs.length > 1
              ? t('loopHintClock', { speed: Math.round(loop.rungs[loop.rungs.length - 1] * 100) })
              : loopStep === null
                ? t('loopHintOnce')
                : loopStep === 'again'
                  ? t('loopAgain')
                  : t('loopUp', { speed: Math.round(tempoOf(loop) * 100) })}
          </span>
        </div>
      )}

      {loop && phase === 'loopBreak' && (
        <div className={styles.prompt} role="status">
          <strong>{loopStep === 'up' ? t('loopUp', { speed: Math.round(tempoOf(loop) * 100) }) : t('loopAgain')}</strong>
        </div>
      )}

      {phase === 'partDone' && part && partResult && (
        <div className={styles.prompt} role="status">
          <strong>{partResult.passed ? `✓ ${t('partLearnt', { part: partName(part) })}` : t('partNearly', { count: partResult.wrong })}</strong>
          {partResult.passed && afterPart && <span>{t('partNext', { part: partName(afterPart) })}</span>}
          <div className={styles.actions}>
            {partResult.passed && afterPart && (
              <Button size="sm" onClick={() => startPart(afterPart)}>
                ▶ {partName(afterPart)}
              </Button>
            )}
            <Button size="sm" variant={partResult.passed && afterPart ? 'outline' : 'primary'} onClick={() => startPart(part)}>
              {t('partAgain')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPhase('setup')}>
              {t('partChoose')}
            </Button>
          </div>
        </div>
      )}

      {loop && phase === 'loopDone' && (
        <div className={styles.prompt} role="status">
          <strong>🎉 {t('loopDone', { bar: loop.bar + 1 })}</strong>
          <span>{t('loopDoneHint')}</span>
          <div className={styles.actions}>
            <Button size="sm" onClick={wholeSong}>
              ▶ {t('wholeSong')}
            </Button>
            <Button size="sm" variant="outline" onClick={backToReport}>
              {t('backToReport')}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.stage}>
        {countIn !== null && phase === 'playing' && <div className={styles.countIn}>{countIn}</div>}
        {phase === 'playing' && streak >= STREAK_SHOWN && (
          <div key={streak} className={styles.streak} data-big={streak % 10 === 0 || undefined} aria-live="polite">
            🔥 {t('streakChip', { count: streak })}
          </div>
        )}
        {phase === 'playing' && (
          <Button size="sm" variant="ghost" className={styles.stageStop} onClick={stop}>
            ■ {t('stop')}
          </Button>
        )}
        <FallingNotes ref={fall} notes={notes} boxes={boxes} results={results} label={label} fingers={settings.fingers} />
        <PlayKeyboard
          sound={!keyboard.connected}
          names={settings.keyNames}
          boxes={boxes}
          held={held}
          targets={phase === 'ready' ? new Set([MIDDLE_C]) : listening ? listenKeys : targets}
          wrong={wrong}
          marker={phase === 'ready' ? MIDDLE_C : undefined}
          label={label}
          onPress={(p) => press(p, performance.now(), true)}
          onRelease={release}
        />
      </div>

    </main>
  )
}
