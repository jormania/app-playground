import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, SegmentedControl } from '../../../ds'
import { barName, barSpan, buildReport, cueFor, handPlaces, Judge, MIN_VELOCITY, notesFor, octaveShift, summaryForHand, type Hand, type JudgeEvent, type JudgeSettings, type NoteResult, type OnWrong, type Practice, type Report, type Song, type SongNote, type Timing } from '../../engine'
import type { StringKey } from '../i18n'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { celebrate } from '../celebrate/celebrate'
import { morph } from '../morph'
import { useApp } from '../context'
import type { Profile } from '../profiles'
import { noteLabel } from '../i18n'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { FallingNotes, type FallingNotesHandle } from './FallingNotes'
import { keyBoxes, rangeFor, widenRange } from './keyGeometry'
import { useWide, WIDE_OCTAVES } from './useWide'
import { SongLibrary } from './library'
import { PlayKeyboard } from './PlayKeyboard'
import { Score, type ScoreHandle } from './notation/Score'
import { ReportView } from './ReportView'
import type { FactsInput } from './coach'
import { afterPass, barSong, isClean, startLoop, tempoOf, type Loop, type LoopStep } from './loop'
import { countBeatMs } from './countIn'
import { nextStep, partPassed, PartsRepo, partSteps, phraseSong, phraseStartMs, type PartStep } from './parts'
import { WARMUP_ID } from '../../engine/starterPack'
import { tryNext } from './level'
import { SetupRepo, SPEEDS, suggestedSpeed, type NotesView, type Speed } from './setup'
import { useStuck } from './stuck'
import { Accompanist } from './accompany'
import { PREFIX } from '../store'
import { songProgress } from './songProgress'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { useOutput } from '../studio/output'
import { Playback, realClock, type Sink } from '../studio/playback'
import { Recorder, type Recording } from '../studio/recorder'
import styles from './songs.module.css'
import setup from '../setup.module.css'

type Phase = 'setup' | 'ready' | 'playing' | 'paused' | 'report' | 'loopBreak' | 'loopDone' | 'partDone'
/** The phases after a run, when nothing is asked of her. */
const OVER: ReadonlySet<Phase> = new Set<Phase>(['setup', 'report', 'loopBreak', 'loopDone', 'partDone'])

const ON_WRONG_LABEL: Record<OnWrong, StringKey> = { keepGoing: 'onWrongKeepGoing', show: 'onWrongShow', wait: 'onWrongWait' }
const TIMING_LABEL: Record<Timing, StringKey> = { relaxed: 'timingRelaxed', normal: 'timingNormal', strict: 'timingStrict' }
const MIDDLE_C = 60
/** How long a key played right stays green. */
const RIGHT_FLASH_MS = 260
/** How long a wrong key stays red. */
const WRONG_FLASH_MS = 350
/** The streak counter appears from this many right notes in a row. */
const STREAK_SHOWN = 5
/** Before the start, the first notes rest this far (song ms) above the hit line. */
const READY_TIME = -1500
/** More parts than this and they're stepped through one at a time instead of shown as chips. */
const MAX_CHIPS = 7
/** The other hand plays itself while she practises one: remembered on the phone. */
const OTHER_HAND_KEY = `${PREFIX}otherHand`
const NO_KEYS: ReadonlySet<number> = new Set()
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
  const [speed, setSpeed] = useState<Speed>(() => suggestedSpeed(song))
  const [view, setView] = useState<NotesView>('falling')
  // What she chose here last time: the hands, the speed and the notes' view, kept per song.
  const setupRepo = useMemo(() => new SetupRepo(store), [store])
  const chosen = useRef(false)
  useEffect(() => {
    if (!profileId) return
    let live = true
    void setupRepo.get(profileId, song.id).then((s) => {
      // A choice she made while it was being read wins over the one remembered.
      if (!live || !s || chosen.current) return
      if (s.practice === 'right' || hasLeft) setPractice(s.practice)
      setSpeed(s.speed)
      setView(s.view ?? 'falling')
    })
    return () => {
      live = false
    }
  }, [setupRepo, profileId, song.id, hasLeft])
  const choose = (next: { practice?: Practice; speed?: Speed; view?: NotesView }) => {
    chosen.current = true
    const setup = { practice: next.practice ?? practice, speed: next.speed ?? speed, view: next.view ?? view }
    setPractice(setup.practice)
    setSpeed(setup.speed)
    morph(() => setView(setup.view))
    if (profileId) void setupRepo.set(profileId, song.id, setup)
  }
  /**
   * The written view: the notes on the staff alone, no falling notes. It always
   * waits for each note (reading takes the time it takes), and a key lights only
   * once she is stuck.
   */
  const written = view === 'written'
  const viewSettings = useMemo((): typeof settings => (written ? { ...settings, onWrong: 'wait' } : settings), [settings, written])
  // Two players on one keyboard: the partner, and the hand the current player takes.
  const { profiles: profileRepo, profile } = useApp()
  const [players, setPlayers] = useState<Profile[]>([])
  useEffect(() => {
    void profileRepo.list().then(setPlayers)
  }, [profileRepo])
  const partners = useMemo(() => players.filter((p) => p.id !== profileId), [players, profileId])
  const [duo, setDuo] = useState<{ partnerId: string; mine: Hand } | null>(null)
  const mate = practice === 'both' && duo ? (partners.find((p) => p.id === duo.partnerId) ?? null) : null
  const [duoResults, setDuoResults] = useState<{ name: string; avatar: string; hand: Hand; stars: number }[] | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [pauseReason, setPauseReason] = useState<'disconnected' | 'hidden' | null>(null)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [wrong, setWrong] = useState<ReadonlySet<number>>(new Set())
  /** Keys just played right, for a moment: the keyboard says yes. */
  const [right, setRight] = useState<ReadonlySet<number>>(new Set())
  const [targets, setTargets] = useState<ReadonlySet<number>>(new Set())
  /** The same, as the notes themselves (by id): the staff marks exactly these, not every note on those keys. */
  const [nowIds, setNowIds] = useState<ReadonlySet<number>>(new Set())
  const [results, setResults] = useState<ReadonlyMap<number, NoteResult['outcome']>>(new Map())
  const [hint, setHint] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  /** What the coach is told about this attempt, with her finishes of the song before it. */
  const [coach, setCoach] = useState<FactsInput | null>(null)
  const [countIn, setCountIn] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  // Practising one bar from the report: the loop, and what the last pass came to.
  const [loop, setLoop] = useState<Loop | null>(null)
  const [loopStep, setLoopStep] = useState<LoopStep | null>(null)
  const loopRef = useRef<Loop | null>(null)
  const loopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Her last try, kept until the next one starts: the keys she pressed, to hear back from the report.
  const tryRec = useRef<Recorder | null>(null)
  const [tryTake, setTryTake] = useState<Recording | null>(null)
  const [hearing, setHearing] = useState(false)
  const tryPlayback = useRef<Playback | null>(null)
  // "Practise one bar" from the setup: which bar, and one waiting for middle C to be found first.
  // The bar the music strip opens on.
  const [scoreBar, setScoreBar] = useState(0)
  const [barOpen, setBarOpen] = useState(false)
  const [barPick, setBarPick] = useState(0)
  const pendingBar = useRef<number | null>(null)
  const [waitingBar, setWaitingBar] = useState<number | null>(null)
  const waitForBar = (bar: number | null) => {
    pendingBar.current = bar
    setWaitingBar(bar)
  }

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
  // A long song's chips run on one line: keep the chosen one in view, in the middle where it can be.
  const chipRow = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = chipRow.current
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return
    row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2
  }, [partId, steps, phase])
  // "Try next" on the report: the easiest song she hasn't finished yet.
  const [next, setNext] = useState<{ id: string; title: string } | null>(null)
  useEffect(() => {
    if (phase !== 'report' || !profileId) return
    let live = true
    void (async () => {
      const [entries, records] = await Promise.all([new SongLibrary(store).list(settings.language), log.read(profileId)])
      const done = songProgress(records)
      const pick = tryNext(entries.filter((e) => e.song.id !== WARMUP_ID), (id) => id === song.id || done.get(id)?.bestStars != null, song.id)
      if (live) setNext(pick ? { id: pick.song.id, title: pick.song.title } : null)
    })()
    return () => {
      live = false
    }
  }, [phase, profileId, store, settings.language, log, song.id])
  const part = steps.find((x) => x.id === partId) ?? null
  /** Finger numbers, unless she has learnt the whole song (these hands) and they are set to fade. */
  const showFingers = settings.fingers && !(settings.fingersFade && learnt.has('whole'))
  /** A part short of the whole song: played on its own, always in "Wait for it". */
  const span = part && part.kind !== 'whole' ? part : null
  /** The middle-C check is done once per visit; the next part starts straight away. */
  const shiftKnown = useRef(false)

  // The other hand, played for her while she practises one (a song with both hands only).
  const [otherHand, setOtherHand] = useState(true)
  useEffect(() => {
    void store.get<boolean>(OTHER_HAND_KEY).then((v) => typeof v === 'boolean' && setOtherHand(v))
  }, [store])
  const chooseOtherHand = (on: boolean) => {
    setOtherHand(on)
    void store.set(OTHER_HAND_KEY, on)
  }
  const accompanist = useRef<Accompanist | null>(null)
  /** "Wait for it": where in the song her last step was, for the other hand to carry on from. */
  const waitFrom = useRef(0)
  /** Where sound goes (set once the keyboard is known, below). */
  const outputRef = useRef<{ sink: () => Sink } | null>(null)
  const accompany = useCallback(
    (target: Song, j: Judge, speed: number) => {
      accompanist.current?.stop()
      accompanist.current = null
      waitFrom.current = j.currentStep?.startMs ?? 0
      if (!otherHand || practice === 'both' || !outputRef.current) return
      const other = notesFor(target, practice === 'right' ? 'left' : 'right')
      if (other.length) accompanist.current = new Accompanist(outputRef.current.sink(), other, speed)
    },
    [otherHand, practice],
  )

  const judge = useRef<Judge | null>(null)
  /** The octave shift found by the middle-C check; applies to the Yamaha only, never to on-screen keys. */
  const shift = useRef(0)
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase
  const fall = useRef<FallingNotesHandle>(null)
  const score = useRef<ScoreHandle>(null)
  const shownTime = useRef(0)

  // What's being played: the song, one part of it, or the one bar being practised.
  const loopBar = loop?.bar ?? null
  const spanFrom = span?.from ?? null
  const spanTo = span?.to ?? null
  const playing = useMemo(() => {
    if (loopBar !== null) return barSong(song, loopBar) ?? song
    if (spanFrom !== null && spanTo !== null) return phraseSong(song, spanFrom, spanTo) ?? song
    return song
  }, [song, loopBar, spanFrom, spanTo])
  const playSettings = useMemo((): typeof settings => (spanFrom !== null ? { ...viewSettings, onWrong: 'wait' } : viewSettings), [viewSettings, spanFrom])
  const notes = useMemo(() => notesFor(playing, practice), [playing, practice])
  const songNotes = useMemo(() => notesFor(song, practice), [song, practice])
  /** A part or a practised bar starts at 0 ms: how far into the song it really is, for the score's playhead. */
  const playOffset = useMemo(() => {
    const first = notes[0]
    const own = first && songNotes.find((n) => n.id === first.id)
    return own ? own.startMs - first.startMs : 0
  }, [notes, songNotes])
  /** The bars being played, when it is a part or a bar: the score draws the rest quieter. */
  const scoreFocus = useMemo(() => {
    if (loopBar !== null) return { from: loopBar, to: loopBar + 1 }
    if (spanFrom === null || spanTo === null) return null
    // A part that starts with its pickup keeps the bar the pickup is in bright too.
    return { from: phraseStartMs(song, spanFrom) !== null ? spanFrom - 1 : spanFrom, to: spanTo }
  }, [song, loopBar, spanFrom, spanTo])
  /** The bar being played at song time `s`: the last note started (or about to), else the first. */
  const barAtTime = useCallback(
    (s: number) => {
      let lo = 0
      let hi = notes.length - 1
      let at = 0
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (notes[mid].startMs <= s + 50) {
          at = mid
          lo = mid + 1
        } else hi = mid - 1
      }
      return notes[at]?.bar ?? 0
    },
    [notes],
  )
  // Before the music starts, and whenever the notes change (another part), the first bar.
  useEffect(() => setScoreBar(notes[0]?.bar ?? 0), [notes])
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
  // Where the hands go, before the start: on the keys, and in words.
  // A bar picked from the setup starts there, not at the part's start.
  const places = useMemo(() => handPlaces(waitingBar !== null ? notesFor(barSong(song, waitingBar) ?? song, practice) : notes, practice), [notes, practice, song, waitingBar])
  const badges = useMemo(() => new Map(places.map((pl) => [pl.pitch, { text: String(pl.finger), hand: pl.hand }] as const)), [places])

  const setLoopBoth = (l: Loop | null) => {
    loopRef.current = l
    setLoop(l)
  }
  /** Her last try, if it is playing back, stops when a new take begins. */
  const silenceTry = () => {
    tryPlayback.current?.stop()
    tryPlayback.current = null
    setHearing(false)
  }
  /** One pass of the practised bar: its own judge, at the loop's tempo, with a count-in when there's a clock. */
  const startPass = useCallback(
    (l: Loop) => {
      const bar = barSong(song, l.bar)
      if (!bar) return
      silenceTry()
      const j = new Judge(bar, { practice, settings: viewSettings, tempo: tempoOf(l), shift: shift.current })
      judge.current = j
      accompany(bar, j, tempoOf(l))
      tryRec.current = null
      if (j.mode === 'running') j.start(performance.now() + (3 * 60000) / song.bpm / tempoOf(l))
      shownTime.current = READY_TIME
      setResults(new Map())
      setStreak(0)
      setPhase('playing')
    },
    [song, practice, viewSettings, accompany],
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

  /** Loop one bar (0-based) until it's clean, from the report or the setup: at the speed chosen. */
  const beginLoop = (bar: number) => {
    const l = startLoop(bar, viewSettings.onWrong === 'wait' ? 'wait' : 'running', tempo)
    setLoopBoth(l)
    setLoopStep(null)
    startPass(l)
  }
  const beginLoopRef = useRef(beginLoop)
  beginLoopRef.current = beginLoop

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
    if (tryRec.current) {
      setTryTake(tryRec.current.stop(performance.now()))
      tryRec.current = null
    }
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
    } else if (profileId && partPassed(summary)) {
      // A song too short for parts is learnt once played through: kept the same way, without a part logged.
      void partsRepo.pass(profileId, song.id, practice, 'whole').then(setLearnt)
    }
    // Written, it always waited: a harder "On a wrong note" or timing wouldn't change how it plays, so none is offered.
    const built = buildReport(summary, settings, pickupFold(song))
    const r = written ? { ...built, suggestion: null } : built
    setReport(r)
    setDuoResults(null)
    setPhase('report')
    setCoach(null)
    if (profileId && mate && duo) {
      // Together: each is scored on their own hand, and it goes in their own log.
      const theirs: Hand = duo.mine === 'right' ? 'left' : 'right'
      const rows = [
        { who: { id: profileId, name: profile?.name ?? '', avatar: profile?.avatar ?? '' }, hand: duo.mine },
        { who: mate, hand: theirs },
      ].map(({ who, hand }) => ({ who, hand, own: buildReport(summaryForHand(summary, hand), settings, pickupFold(song)) }))
      setDuoResults(rows.map(({ who, hand, own }) => ({ name: who.name, avatar: who.avatar, hand, stars: own.stars })))
      for (const { who, hand, own } of rows) {
        void log.add(who.id, { type: 'song_finished', songId: song.id, practice: hand, stars: own.stars, score: Math.round(own.score * 100) / 100, hit: own.hit, total: own.total, wrong: own.wrong })
      }
    } else if (profileId) {
      // Her earlier finishes are read before this one is written, for the coach.
      void log.read(profileId).then((records) => {
        const earlier = records.flatMap((x) => (x.type === 'song_finished' && x.songId === song.id ? [{ stars: x.stars, score: Math.round(x.score * 100) }] : []))
        setCoach({ song, summary, report: r, practice, tempo, names: settings.noteNames, language: settings.language, earlier })
        return log.add(profileId, { type: 'song_finished', songId: song.id, practice, stars: r.stars, score: Math.round(r.score * 100) / 100, hit: r.hit, total: r.total, wrong: r.wrong })
      })
    }
  }, [settings, profileId, profile, log, song, practice, tempo, endLoop, startPass, part, partsRepo, mate, duo, written])

  // Written view: the keys stay dark until she is stuck. A step is the notes asked for: a chord half played is still the same step.
  const stepKey = [...nowIds].join(',')
  const { stuck, wrongKey } = useStuck(stepKey, written && phase === 'playing')

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
        if (e.type === 'hit') {
          const p = e.result.note.pitch
          setRight((r) => new Set(r).add(p))
          setTimeout(() => setRight((r) => { const n = new Set(r); n.delete(p); return n }), RIGHT_FLASH_MS)
        }
        // "Wait for it": each step she plays lets the other hand carry on to her next one.
        if (e.type === 'advance' || (e.type === 'done' && judge.current?.mode === 'wait')) {
          const to = e.type === 'advance' ? e.step.startMs : Infinity
          accompanist.current?.stepPlayed(waitFrom.current, to, performance.now())
          waitFrom.current = to
        }
        // The streak: right notes in a row; a wrong or missed note starts it again, quietly.
        if (e.type === 'hit') setStreak((n) => n + 1)
        if (e.type === 'wrong' || e.type === 'missed') setStreak(0)
        if (e.type === 'wrong') wrongKey()
      }
      if (outcomes.length) setResults((r) => new Map([...r, ...outcomes]))
      if (events.some((e) => e.type === 'done')) morph(finish)
    },
    [playSettings, finish, wrongKey],
  )

  /** Judge from now: the song, or its part, as chosen. */
  const startJudge = useCallback(
    (target: Song, js: JudgeSettings, at: number, partOf: PartStep | null) => {
      const j = new Judge(target, { practice, settings: js, tempo, shift: shift.current })
      judge.current = j
      accompany(target, j, tempo)
      if (j.mode === 'running') {
        // Three counted beats of lead-in: the first notes are already falling.
        const leadIn = (3 * countBeatMs(song)) / tempo
        j.start(at + leadIn)
      }
      shownTime.current = READY_TIME
      silenceTry()
      tryRec.current = new Recorder(at)
      setTryTake(null)
      setResults(new Map())
      setStreak(0)
      setPartResult(null)
      setPhase('playing')
      if (profileId) void log.add(profileId, { type: 'song_started', songId: song.id, practice, tempo, mode: j.mode, ...(partOf ? { part: partOf.id } : {}), ...(written ? { view: 'written' } : {}) })
    },
    [song, practice, tempo, profileId, log, accompany, written],
  )

  /** Straight into a part (from "Next" or "Again"): no middle C again once it's known. */
  const startPart = (step: PartStep) =>
    morph(() => {
      setPartId(step.id)
      const target = step.kind === 'whole' ? song : (phraseSong(song, step.from, step.to) ?? song)
      const js: JudgeSettings = step.kind === 'whole' ? viewSettings : { ...viewSettings, onWrong: 'wait' }
      if (shiftKnown.current) startJudge(target, js, performance.now(), step)
      else setPhase('ready')
    })

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
      // A bar asked for from the setup was waiting for the keyboard's octave to be known.
      if (pendingBar.current !== null) {
        const bar = pendingBar.current
        pendingBar.current = null
        setWaitingBar(null)
        morph(() => beginLoopRef.current(bar))
        return
      }
      morph(() => startJudge(playing, playSettings, at, part))
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
      if (phaseRef.current === 'playing') tryRec.current?.noteOn(drawn, 80, at)
      if (phaseRef.current === 'ready') begin(pitch, at, fromScreen)
      else if (phaseRef.current === 'playing' && judge.current) apply(judge.current.press(fromScreen ? pitch - shift.current : pitch, at))
    },
    [begin, apply],
  )
  const release = useCallback((drawn: number, at = performance.now()) => {
    tryRec.current?.noteOff(drawn, at)
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
      if (e.type === 'noteoff') return release(e.note + shift.current, e.time)
      if (e.velocity < MIN_VELOCITY) return
      // The other hand's own notes, if the keyboard sends them back, are not hers.
      if (accompanist.current?.isEcho(e.note, e.time)) return
      press(e.note, e.time, false)
    },
    [press, release],
  )
  const keyboard = useKeyboard(onMidi)

  // Listen first: the song played for her (on the keyboard, or the phone) at the
  // chosen hands and speed, the notes falling and their keys lighting as it goes.
  const output = useOutput(keyboard)
  outputRef.current = output
  const [listening, setListening] = useState(false)
  const [listenKeys, setListenKeys] = useState<ReadonlySet<number>>(new Set())
  const [listenIds, setListenIds] = useState<ReadonlySet<number>>(new Set())
  const listenPlayback = useRef<Playback | null>(null)
  const stopListening = useCallback(() => {
    listenPlayback.current?.stop()
    listenPlayback.current = null
    morph(() => {
      setListening(false)
      setListenKeys(new Set())
      setListenIds(new Set())
      fall.current?.setTime(READY_TIME)
    })
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
    morph(() => setListening(true))
    if (profileId) void log.add(profileId, { type: 'song_listened', songId: song.id, practice, tempo })
  }
  // Hear her try back: the keys she pressed, played as she pressed them, from the report.
  const stopHearing = useCallback(() => {
    tryPlayback.current?.stop()
    tryPlayback.current = null
    setHearing(false)
  }, [])
  const hearTry = () => {
    if (hearing) return stopHearing()
    if (!tryTake || tryTake.notes.length === 0) return
    const p = new Playback({ ...tryTake, ms: tryTake.ms + 300 }, output.sink(), realClock, stopHearing)
    tryPlayback.current = p
    p.start()
    setHearing(true)
  }
  useEffect(() => () => tryPlayback.current?.stop(), [])
  const hear = tryTake && tryTake.notes.length > 0 ? { playing: hearing, onToggle: hearTry } : null

  useEffect(() => {
    if (!listening) return
    let raf = 0
    let lastKeys = ''
    const frame = () => {
      const p = listenPlayback.current
      if (!p) return
      const s = p.position() * tempo
      fall.current?.setTime(s)
      score.current?.setTime(s + playOffset)
      setScoreBar((b) => {
        const next = barAtTime(s)
        return next === b ? b : next
      })
      const playingNow = notes.filter((n) => n.startMs <= s && s < n.startMs + n.durationMs)
      const sounding = playingNow.map((n) => n.pitch)
      const key = playingNow.map((n) => n.id).join(',')
      if (key !== lastKeys) {
        lastKeys = key
        setListenKeys(new Set(sounding))
        setListenIds(new Set(playingNow.map((n) => n.id)))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [listening, notes, tempo, barAtTime, playOffset])
  useEffect(
    () => () => {
      listenPlayback.current?.stop()
      accompanist.current?.stop()
    },
    [],
  )

  // Pause when the keyboard disappears or KeyPath leaves the screen; never count those as misses.
  const pause = useCallback((reason: 'disconnected' | 'hidden') => {
    if (phaseRef.current !== 'playing' || judge.current?.mode !== 'running') return
    judge.current.pause(performance.now())
    accompanist.current?.stop()
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
    // A keyboard plugged in or out may be set to another octave: ask for middle C again.
    if (wasConnected.current !== keyboard.connected) shiftKnown.current = false
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
      let next: SongNote[]
      if (j.mode === 'running') {
        apply(j.tick(now))
        accompanist.current?.tick(j.songTime(now), now)
        target = j.songTime(now)
        shownTime.current = target
        const s = j.songTime(now)
        setScoreBar((b) => {
          const next = barAtTime(s)
          return next === b ? b : next
        })
        setCountIn(s < 0 ? Math.ceil(-s / countBeatMs({ bpm: song.bpm })) : null)
        next = notes.filter((n) => n.startMs >= s - 150 && n.startMs <= s + 450 && !results.has(n.id))
      } else {
        const step = j.currentStep
        if (step?.notes[0]) setScoreBar((b) => (step.notes[0].bar === b ? b : step.notes[0].bar))
        target = step?.startMs ?? shownTime.current
        // Glide to the waiting step rather than jumping.
        shownTime.current += (target - shownTime.current) * 0.2
        next = step ? step.notes : []
      }
      fall.current?.setTime(shownTime.current)
      score.current?.setTime(shownTime.current + playOffset)
      const key = next.map((n) => n.id).sort((a, b) => a - b).join(',')
      if (key !== lastTargets) {
        lastTargets = key
        setTargets(new Set(next.map((n) => n.pitch)))
        setNowIds(new Set(next.map((n) => n.id)))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, apply, notes, results, song.bpm, barAtTime, playOffset])

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
    accompanist.current?.stop()
    const j = judge.current
    if (j && profileId && phaseRef.current !== 'report') {
      const s = j.summary()
      void log.add(profileId, { type: 'song_abandoned', songId: song.id, practice, hit: s.results.filter((r) => r.outcome === 'hit').length, total: s.total })
    }
    judge.current = null
    tryRec.current = null
    morph(() => {
      setPhase('setup')
      setResults(new Map())
      setStreak(0)
      setCountIn(null)
    })
  }

  const carryOn = () => {
    judge.current?.resume(performance.now())
    setPauseReason(null)
    setPhase('playing')
  }

  const practiseBar = (bar: number) => morph(() => beginLoop(bar))
  /** From the setup: straight in once middle C has been found this visit, else ask for it first. */
  const practiseBarFromSetup = (bar: number) => {
    stopListening()
    if (shiftKnown.current) return practiseBar(bar)
    waitForBar(bar)
    morph(() => setPhase('ready'))
  }
  /** Out of a practised bar: to the report it came from, or, from the setup, back to the setup. */
  const backToReport = () =>
    morph(() => {
      accompanist.current?.stop()
      endLoop(false)
      setLoopBoth(null)
      judge.current = null
      setCountIn(null)
      setPhase(report ? 'report' : 'setup')
    })
  const wholeSong = () =>
    morph(() => {
      setLoopBoth(null)
      setLoopStep(null)
      judge.current = null
      setReport(null)
      // The whole song, not the bar just looped (this render's `playing` is still the bar),
      // nor the phrase chosen before it: finished, it counts as the whole song learnt.
      const whole = steps.find((x) => x.kind === 'whole') ?? null
      if (whole) setPartId(whole.id)
      if (shiftKnown.current) startJudge(song, viewSettings, performance.now(), whole)
      else setPhase('ready')
    })

  /** From the setup or the report: straight in once middle C has been found this visit, else ask for it. */
  const go = () =>
    morph(() => {
      stopListening()
      stopHearing()
      if (shiftKnown.current) startJudge(playing, playSettings, performance.now(), part)
      else setPhase('ready')
    })
  const playAgain = () =>
    morph(() => {
      judge.current = null
      setReport(null)
      setResults(new Map())
      setStreak(0)
      go()
    })

  const partName = (x: PartStep) => (x.kind === 'phrase' ? t('partPhrase', { n: x.first }) : x.kind === 'join' ? t('partJoin', { a: x.first, b: x.last }) : t('partWhole'))
  const chipName = (x: PartStep) => (x.kind === 'phrase' ? String(x.first) : x.kind === 'join' ? `${x.first}–${x.last}` : t('partWholeShort'))
  const afterPart = part ? (steps[steps.indexOf(part) + 1] ?? null) : null

  /** Listening, or anywhere from "press middle C" to the end of a take: the screen is for the notes. */
  const musicOn = listening || phase !== 'setup'

  const barTotal = songNotes.length ? Math.max(...songNotes.map((n) => n.bar)) + 1 : 1
  // A pickup (bar 0, as printed) is a note or two: the bars to practise start at the first whole one.
  const firstBar = barTotal > 1 && barName(song, 0) === '0' ? 1 : 0
  const barAt = Math.max(firstBar, Math.min(barPick, barTotal - 1))
  const barLink = (
    <button type="button" className={setup.link} aria-expanded={barOpen} onClick={() => setBarOpen((o) => !o)}>
      🔁 {barOpen ? t('practiseBarHide') : t('practiseOneBar')}
    </button>
  )

  if (phase === 'report' && report) {
    return (
      <main className={styles.screen}>
        <TopBar title={song.title} />
        <ReportView report={report} songId={song.id} coach={duoResults ? null : coach} together={duoResults} hear={hear} barLabel={(b) => barName(song, b)} onPlayAgain={playAgain} onPractiseBar={practiseBar} next={next && { title: next.title, onOpen: () => navigate({ name: 'play', songId: next.id }) }} onAnotherSong={() => navigate({ name: 'door', door: 'songs' })} onMakeItYours={() => navigate({ name: 'studio', songId: song.id })} />
      </main>
    )
  }

  return (
    <main className={styles.playScreen}>
      <TopBar
        title={song.title}
        compact={musicOn}
        aside={
          <div className={styles.headAside}>
            {/* Where she is, while the music is on: the part and the bar. */}
            {(phase === 'playing' || listening) && (
              <span className={styles.progress}>
                {span && <span className={styles.progressPart}>{`${partName(span)} · `}</span>}
                {t('progressBar', { bar: barName(song, Math.max(scoreBar, firstBar)), total: barName(song, barTotal - 1) })}
              </span>
            )}
            <KeyboardStatus status={keyboard} missing="keyboardMissing" compact={musicOn} />
            {(phase === 'playing' || listening) && (
              <Button size="sm" variant="outline" className={styles.headStop} aria-label={t('stop')} onClick={listening ? stopListening : stop}>
                ■<span className={styles.headStopWord}> {t('stop')}</span>
              </Button>
            )}
          </div>
        }
      />

      {/* The choices are for before the music; once it plays, or while she listens, they fold away and the notes get the screen. */}
      {phase === 'setup' && !listening && (
        <section className={setup.bar}>
          {hasLeft && (
            <div className={setup.field}>
              <span className={setup.label}>{t('hands')}</span>
              <div className={setup.controls}>
                <SegmentedControl
                  size="sm"
                  value={practice}
                  onChange={(v) => choose({ practice: v as Practice })}
                  options={[
                    { value: 'right', label: t('handRight') },
                    { value: 'left', label: t('handLeft') },
                    { value: 'both', label: t('handBoth') },
                  ]}
                />
                {practice !== 'both' && (
                  <button type="button" className={setup.chip} aria-pressed={otherHand} aria-label={t('otherHandFull')} onClick={() => chooseOtherHand(!otherHand)}>
                    🎹 {t('otherHand')}
                  </button>
                )}
              </div>
            </div>
          )}
          {hasLeft && practice === 'both' && partners.length > 0 && (
            <div className={setup.field}>
              <span className={setup.label}>{t('together')}</span>
              <div className={setup.chips} role="group" aria-label={t('togetherFull')}>
                <button type="button" className={setup.chip} aria-pressed={!mate} onClick={() => setDuo(null)}>
                  {t('togetherAlone')}
                </button>
                {partners.map((p) => (
                  <button key={p.id} type="button" className={setup.chip} aria-pressed={mate?.id === p.id} onClick={() => setDuo({ partnerId: p.id, mine: duo?.mine ?? 'right' })}>
                    {p.avatar} {p.name}
                  </button>
                ))}
              </div>
              {mate && duo && (
                <SegmentedControl
                  size="sm"
                  value={duo.mine}
                  onChange={(v) => setDuo({ partnerId: mate.id, mine: v as Hand })}
                  options={[
                    { value: 'right', label: t('togetherYouRight') },
                    { value: 'left', label: t('togetherYouLeft') },
                  ]}
                />
              )}
            </div>
          )}
          {steps.length > 0 && (
            <div className={setup.field}>
              <span className={setup.label}>{t('parts')}</span>
              {/* The same chips for every song; a long one's run on one line that scrolls sideways, the chosen one in view. */}
              <div ref={chipRow} className={setup.chips} data-scroll={steps.length > MAX_CHIPS || undefined} role="group" aria-label={t('parts')}>
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
            <SegmentedControl size="sm" value={speed} onChange={(v) => choose({ speed: v as Speed })} options={SPEEDS.map((s) => ({ value: s, label: `${Math.round(Number(s) * 100)}%` }))} />
          </div>
          <div className={setup.field}>
            <span className={setup.label}>{t('notesView')}</span>
            <SegmentedControl
              size="sm"
              value={view}
              onChange={(v) => choose({ view: v as NotesView })}
              options={[
                { value: 'falling', label: t('viewFalling') },
                { value: 'written', label: t('viewWritten') },
              ]}
            />
          </div>
          <div className={setup.go}>
            <Button onClick={go}>
              ▶ {span ? partName(span) : t('startSong')}
            </Button>
            <Button variant="outline" onClick={listen}>
              🎧 {t('listen')}
            </Button>
          </div>
          {span ? (
            <p className={setup.note} data-inline>
              {t('partMode', { bars: barSpan(song, span.from, span.to) })}
              {barLink}
            </p>
          ) : (
            <p className={setup.note} data-inline>
              <span>{written ? t('writtenMode') : t('playMode', { mode: t(ON_WRONG_LABEL[settings.onWrong]), timing: t(TIMING_LABEL[settings.timing]) })}</span>
              {/* Written always waits: her On a wrong note setting doesn't apply, so there is nothing to change there. */}
              {!written && (
                <button type="button" className={setup.link} onClick={() => navigate({ name: 'settings' })}>
                  {t('playModeChange')}
                </button>
              )}
              {barLink}
            </p>
          )}
          {barOpen && (
            <div className={setup.field}>
              <span className={setup.label}>{t('barPickLabel')}</span>
              <div className={setup.controls}>
                <div className={styles.keyPick}>
                  <Button size="sm" variant="outline" disabled={barAt <= firstBar} onClick={() => setBarPick(barAt - 1)} aria-label={t('barPickLower')}>
                    −
                  </Button>
                  <span className={styles.keyPickValue} aria-live="polite">
                    {barName(song, barAt)}
                  </span>
                  <Button size="sm" variant="outline" disabled={barAt >= barTotal - 1} onClick={() => setBarPick(barAt + 1)} aria-label={t('barPickHigher')}>
                    +
                  </Button>
                </div>
                <Button size="sm" onClick={() => practiseBarFromSetup(barAt)}>
                  🔁 {t('barLoop')}
                </Button>
              </div>
            </div>
          )}
          {output.phoneMuted && <p className={setup.note}>{t('studioPhoneMuted')}</p>}
        </section>
      )}

      {listening && output.phoneMuted && (
        <div className={styles.prompt} role="status">
          {t('studioPhoneMuted')}
        </div>
      )}

      {phase === 'ready' && (
        <div className={styles.prompt} role="status">
          <strong>{t('pressMiddleC')}</strong>
          <span>{hint ?? t('pressMiddleCHint')}</span>
          {places.length > 0 && (
            <span className={styles.placeLine}>
              {places.map((pl) => t(pl.hand === 'right' ? (pl.finger === 1 ? 'placeRightThumb' : 'placeRightLittle') : pl.finger === 1 ? 'placeLeftThumb' : 'placeLeftLittle', { note: label(pl.pitch) })).join(' · ')}
            </span>
          )}
          {song.fingersSuggested && showFingers && <span className={styles.placeLine}>{t('fingersSuggestedNote')}</span>}
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                waitForBar(null)
                morph(() => setPhase('setup'))
              }}
            >
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
            🔁 {t('loopBar', { bar: barName(song, loop.bar) })}
            {viewSettings.onWrong !== 'wait' && ` · ${Math.round(tempoOf(loop) * 100)}%`}
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
          <div className={styles.actions}>
            {partResult.passed && afterPart && (
              <Button size="sm" onClick={() => startPart(afterPart)}>
                ▶ {partName(afterPart)}
              </Button>
            )}
            <Button size="sm" variant={partResult.passed && afterPart ? 'outline' : 'primary'} onClick={() => startPart(part)}>
              {t('partAgain')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => morph(() => setPhase('setup'))}>
              {t('partChoose')}
            </Button>
            {hear && (
              <Button size="sm" variant="ghost" onClick={hear.onToggle}>
                🎧 {hear.playing ? t('hearStop') : t('hearTry')}
              </Button>
            )}
          </div>
        </div>
      )}

      {loop && phase === 'loopDone' && (
        <div className={styles.prompt} role="status">
          <strong>🎉 {t('loopDone', { bar: barName(song, loop.bar) })}</strong>
          <span>{t('loopDoneHint')}</span>
          <div className={styles.actions}>
            <Button size="sm" onClick={wholeSong}>
              ▶ {t('wholeSong')}
            </Button>
            <Button size="sm" variant="outline" onClick={backToReport}>
              {report ? t('backToReport') : t(hasLeft ? 'backToSetupHands' : 'backToSetupSpeed')}
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
        {written && (
          <Score
            song={song}
            notes={songNotes}
            practice={practice}
            bar={scoreBar}
            now={listening ? listenIds : phase === 'ready' || phase === 'setup' ? NO_KEYS : nowIds}
            results={results}
            wrong={wrong}
            focus={scoreFocus}
            size="big"
            follow="now"
            beatMs={60000 / song.bpm}
            ariaLabel={t('scoreAria', { a: barName(song, scoreBar), b: barName(song, scoreBar + 1) })}
          />
        )}
        {!written && settings.score && musicOn && (
          <Score
            ref={score}
            song={song}
            notes={songNotes}
            practice={practice}
            bar={scoreBar}
            now={listening ? listenIds : phase === 'ready' || phase === 'setup' ? NO_KEYS : nowIds}
            results={results}
            focus={scoreFocus}
            size="strip"
            follow="time"
            beatMs={60000 / song.bpm}
            ariaLabel={t('scoreAria', { a: barName(song, scoreBar), b: barName(song, scoreBar + 1) })}
          />
        )}
        {!written && <FallingNotes ref={fall} notes={notes} boxes={boxes} results={results} label={label} fingers={showFingers} suggested={song.fingersSuggested} />}
        <PlayKeyboard
          sound={!keyboard.connected}
          names={settings.keyNames}
          boxes={boxes}
          held={held}
          // Nothing is asked for once a part, a bar's loop or the song is over: no key stays lit as if it were.
          targets={phase === 'ready' ? new Set([MIDDLE_C]) : listening ? listenKeys : (written && !stuck) || OVER.has(phase) ? NO_KEYS : targets}
          wrong={wrong}
          marker={phase === 'ready' ? MIDDLE_C : undefined}
          markerLabel={t('markerMiddleC')}
          right={right}
          badges={phase === 'ready' || (phase === 'setup' && !listening) ? badges : undefined}
          label={label}
          onPress={(p) => press(p, performance.now(), true)}
          onRelease={(p) => release(p)}
        />
      </div>

    </main>
  )
}

/** A song with a pickup (bar 0, as printed) counts it with bar 1 in the report. */
const pickupFold = (song: Song) => (barName(song, 0) === '0' ? (b: number) => Math.max(b, 1) : undefined)
