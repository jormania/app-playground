import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, SegmentedControl } from '../../../ds'
import { handPlaces, Judge, MIN_VELOCITY, notesFor, octaveShift, type JudgeEvent, type NoteResult } from '../../engine'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { celebrate } from '../celebrate/celebrate'
import { useApp } from '../context'
import { noteLabel } from '../i18n'
import { morph } from '../morph'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { IntroCard, IntroLink, useIntro } from '../screens/IntroCard'
import { keyBoxes, rangeFor, widenRange } from '../songs/keyGeometry'
import { PlayKeyboard } from '../songs/PlayKeyboard'
import { Score } from '../songs/notation/Score'
import { useStuck } from '../songs/stuck'
import { useWide, WIDE_OCTAVES } from '../songs/useWide'
import { READ_LEVEL_NAME } from './ChallengesHome'
import { levelPitches, pieceFor, READ_BEAT_MS, READ_ROUND, type ReadLevel, type ReadPiece } from './readPlay'
import { RecordRepo, type ChallengeRecords } from './records'
import styles from './challenges.module.css'
import songStyles from '../songs/songs.module.css'
import setup from '../setup.module.css'

type Phase = 'setup' | 'ready' | 'play' | 'between' | 'result'
const MIDDLE_C = 60
const FLASH_MS = 350
/** How long a finished piece's verdict stays before the next one. */
const BETWEEN_MS = 1300
const NO_KEYS: ReadonlySet<number> = new Set()

/** Read and play: a short piece, made up on the spot, read from the staff with the keys dark. Five to a round. */
export function ReadPlayScreen() {
  const { t, store, profile, log, settings } = useApp()
  // The first look: what the game is, until she says not to show it again.
  const intro = useIntro('read')
  const repo = useMemo(() => new RecordRepo(store), [store])
  const [records, setRecords] = useState<ChallengeRecords | null>(null)
  const [level, setLevel] = useState<ReadLevel>(1)
  const [phase, setPhase] = useState<Phase>('setup')
  const [piece, setPiece] = useState<ReadPiece | null>(null)
  const [number, setNumber] = useState(1)
  const [score, setScore] = useState(0)
  const [clean, setClean] = useState<boolean | null>(null)
  const [results, setResults] = useState<ReadonlyMap<number, NoteResult['outcome']>>(new Map())
  const [targets, setTargets] = useState<ReadonlySet<number>>(NO_KEYS)
  /** The same notes, by id, for the staff to mark. */
  const [nowIds, setNowIds] = useState<ReadonlySet<number>>(NO_KEYS)
  const [bar, setBar] = useState(0)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [wrong, setWrong] = useState<ReadonlySet<number>>(new Set())
  const [right, setRight] = useState<ReadonlySet<number>>(new Set())
  const [hint, setHint] = useState<string | null>(null)
  const [result, setResult] = useState<{ score: number; wrong: number; best: boolean } | null>(null)
  const judge = useRef<Judge | null>(null)
  /** The octave the keyboard is set to, found once a visit from middle C; on-screen keys need none. */
  const shift = useRef(0)
  const shiftKnown = useRef(false)
  const round = useRef<{ level: ReadLevel; number: number; score: number; wrong: number; startedAt: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const phaseRef = useRef<Phase>('setup')
  phaseRef.current = phase
  const profileId = profile?.id ?? null

  useEffect(() => {
    if (profileId) void repo.get(profileId).then(setRecords)
  }, [repo, profileId])

  const label = useCallback((p: number) => noteLabel(p, settings.noteNames, settings.language), [settings.noteNames, settings.language])

  /** The keys the judge waits for now, and the bar they're in. */
  const showStep = (j: Judge) => {
    const step = j.currentStep
    setTargets(step ? new Set(step.notes.map((n) => n.pitch)) : NO_KEYS)
    setNowIds(step ? new Set(step.notes.map((n) => n.id)) : NO_KEYS)
    if (step?.notes[0]) setBar(step.notes[0].bar)
  }

  /** A piece on the staff, waiting for its first note. */
  const beginPiece = (p: ReadPiece) => {
    const j = new Judge(p.song, { practice: p.practice, settings: { ...settings, onWrong: 'wait' }, shift: shift.current })
    judge.current = j
    setPiece(p)
    setResults(new Map())
    setClean(null)
    setWrong(new Set())
    showStep(j)
    setPhase('play')
  }

  const start = () =>
    morph(() => {
      round.current = { level, number: 1, score: 0, wrong: 0, startedAt: performance.now() }
      setNumber(1)
      setScore(0)
      setResult(null)
      setHint(null)
      setHeld(new Set())
      const first = pieceFor(level, Math.random, 1)
      setPiece(first)
      if (shiftKnown.current) beginPiece(first)
      else setPhase('ready')
      if (profileId) void log.add(profileId, { type: 'challenge_started', game: 'read', level })
    })

  const finish = useCallback(async () => {
    const r = round.current
    round.current = null
    judge.current = null
    if (!r || !profileId) return
    const best = await repo.offer(profileId, 'read', r.level, r.score)
    setRecords(await repo.get(profileId))
    morph(() => {
      setResult({ score: r.score, wrong: r.wrong, best })
      setPhase('result')
    })
    if (best) celebrate('newBest')
    void log.add(profileId, { type: 'challenge_finished', game: 'read', level: r.level, score: r.score, best, wrong: r.wrong, ms: Math.round(performance.now() - r.startedAt) })
  }, [repo, profileId, log])

  /** Out of a round before its end (Stop, or back from middle C): counted as left, as leaving the screen is. */
  const leave = () => {
    clearTimeout(timer.current)
    const r = round.current
    round.current = null
    judge.current = null
    if (r && profileId) void log.add(profileId, { type: 'challenge_left', game: 'read', level: r.level, ms: Math.round(performance.now() - r.startedAt) })
    morph(() => setPhase('setup'))
  }

  const flashWrong = (pitch: number) => {
    setWrong((w) => new Set(w).add(pitch))
    setTimeout(() => setWrong((w) => { const s = new Set(w); s.delete(pitch); return s }), FLASH_MS)
  }

  // A step is the notes asked for: a chord half played is still the same step, and stays lit once she was stuck.
  const stepKey = `${number}|${[...nowIds].join(',')}`
  const { stuck, wrongKey } = useStuck(stepKey, phase === 'play')

  const apply = (j: Judge, events: JudgeEvent[], drawn: number) => {
    const r = round.current
    if (!r) return
    const hits: [number, NoteResult['outcome']][] = []
    for (const e of events) {
      if (e.type === 'hit') {
        hits.push([e.result.note.id, 'hit'])
        const p = e.result.note.pitch
        setRight((s) => new Set(s).add(p))
        setTimeout(() => setRight((s) => { const n = new Set(s); n.delete(p); return n }), 260)
      }
      if (e.type === 'wrong') {
        r.wrong++
        flashWrong(drawn)
        wrongKey()
      }
    }
    if (hits.length) setResults((m) => new Map([...m, ...hits]))
    showStep(j)
    if (!events.some((e) => e.type === 'done')) return
    // The piece is played: a point if not one key went astray.
    const ok = j.summary().wrong.length === 0
    if (ok) r.score++
    setScore(r.score)
    setClean(ok)
    setPhase('between')
    if (ok) celebrate('stepPassed')
    timer.current = setTimeout(() => {
      if (r.number >= READ_ROUND) return void finish()
      r.number++
      setNumber(r.number)
      const next = pieceFor(r.level, Math.random, r.number)
      // A keyboard plugged in or out since may be set to another octave: middle C again first.
      if (shiftKnown.current) morph(() => beginPiece(next))
      else
        morph(() => {
          setPiece(next)
          setPhase('ready')
        })
    }, BETWEEN_MS)
  }

  /** One key down: from the Yamaha (as it sends it) or the screen (as drawn). */
  const press = (pitch: number, at: number, fromScreen: boolean) => {
    const drawn = fromScreen ? pitch : pitch + shift.current
    setHeld((h) => new Set(h).add(drawn))
    if (phaseRef.current === 'ready') {
      // Middle C first, to know the keyboard's octave; on the screen's keys, only middle C itself.
      const found = fromScreen ? (pitch === MIDDLE_C ? 0 : null) : octaveShift(pitch, MIDDLE_C)
      if (found === null) return setHint(t('notAC', { note: label(pitch) }))
      setHint(null)
      shift.current = found
      shiftKnown.current = true
      if (piece) morph(() => beginPiece(piece))
      return
    }
    const j = judge.current
    if (phaseRef.current !== 'play' || !j) return
    apply(j, j.press(fromScreen ? pitch - shift.current : pitch, at), drawn)
  }
  const pressRef = useRef(press)
  pressRef.current = press
  const release = useCallback((drawn: number) => setHeld((h) => { const s = new Set(h); s.delete(drawn); return s }), [])

  const onMidi = useCallback(
    (e: MidiEvent) => {
      if ((e.type !== 'noteon' && e.type !== 'noteoff') || !isPlayerChannel(e.channel)) return
      if (e.type === 'noteoff') return release(e.note + shift.current)
      if (e.velocity >= MIN_VELOCITY) pressRef.current(e.note, e.time, false)
    },
    [release],
  )
  const kb = useKeyboard(onMidi)
  // A keyboard plugged in or out may be set to another octave: ask for middle C again next time.
  const wasConnected = useRef(kb.connected)
  useEffect(() => {
    if (wasConnected.current !== kb.connected) shiftKnown.current = false
    wasConnected.current = kb.connected
  }, [kb.connected])

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      const r = round.current
      if (r && profileId) void log.add(profileId, { type: 'challenge_left', game: 'read', level: r.level, ms: Math.round(performance.now() - r.startedAt) })
    },
    [log, profileId],
  )

  const wide = useWide()
  const boxes = useMemo(() => {
    const r = rangeFor(levelPitches(level))
    const shown = wide ? widenRange(r, WIDE_OCTAVES) : r
    return keyBoxes(shown.low, shown.high)
  }, [level, wide])
  const notes = useMemo(() => (piece ? notesFor(piece.song, piece.practice) : []), [piece])
  // Where the hands go, until the first note is played.
  const places = useMemo(() => (piece ? handPlaces(notes, piece.practice) : []), [notes, piece])
  const badges = useMemo(() => new Map(places.map((pl) => [pl.pitch, { text: String(pl.finger), hand: pl.hand }] as const)), [places])
  const best = records?.read[level]
  const running = phase === 'ready' || phase === 'play' || phase === 'between'
  const keysLit = phase === 'ready' ? new Set([MIDDLE_C]) : phase === 'play' && stuck ? targets : NO_KEYS

  return (
    <main className={styles.playScreen}>
      <TopBar title={t('readTitle')} compact={running} aside={<KeyboardStatus status={kb} missing="keyboardMissing" compact={running} />} />
      <IntroCard id="read" open={intro.open && phase === 'setup'} onClose={intro.close} onNever={intro.never} />

      {phase === 'setup' && (
        <section className={setup.bar}>
          <p className={setup.lead}>{t('readBlurb')}</p>
          <div className={setup.field}>
            <span className={setup.label}>{t('level')}</span>
            <SegmentedControl size="sm" value={String(level)} onChange={(v) => setLevel(Number(v) as ReadLevel)} options={[1, 2, 3].map((l) => ({ value: String(l), label: t(READ_LEVEL_NAME[l]) }))} />
          </div>
          <div className={setup.go}>
            <Button onClick={start}>▶ {t('go')}</Button>
            <IntroLink onShow={intro.show} />
            <span className={setup.note} data-inline>
              {best !== undefined ? t('best', { score: best }) : t('noBest')}
            </span>
            <span className={setup.note} data-inline>
              {t('readHintPlain')}
            </span>
          </div>
        </section>
      )}

      {phase === 'ready' && (
        <div className={songStyles.prompt} role="status">
          <strong>{t('pressMiddleC')}</strong>
          <span>{hint ?? t('pressMiddleCHint')}</span>
          <div className={songStyles.actions}>
            <Button size="sm" variant="ghost" onClick={leave}>
              {t('changeLevel')}
            </Button>
          </div>
        </div>
      )}

      {(phase === 'play' || phase === 'between') && (
        <section className={styles.readHead} role="status" aria-live="polite">
          <span className={styles.raceFind}>{t('readQuestion', { n: number })}</span>
          <span className={styles.readSay}>
            {phase === 'between'
              ? clean
                ? `✓ ${t('readClean')}`
                : t('readSlips')
              : results.size === 0 && places.length > 0
                ? places.map((pl) => t(pl.hand === 'right' ? (pl.finger === 1 ? 'placeRightThumb' : 'placeRightLittle') : pl.finger === 1 ? 'placeLeftThumb' : 'placeLeftLittle', { note: label(pl.pitch) })).join(' · ')
                : stuck
                  ? t('readStuck')
                  : t('readGo')}
          </span>
          <span className={styles.scoreWrap}>{t('readScore', { score })}</span>
          <Button size="sm" variant="ghost" onClick={leave}>
            ■ {t('stop')}
          </Button>
        </section>
      )}

      {phase === 'result' && result && (
        <section className={styles.panel} role="status">
          <h2 className={styles.resultTitle}>{result.score > 0 ? t('readDone', { score: result.score }) : t('readNone')}</h2>
          {result.best && <p className={styles.newBest}>★ {t('newBest')}</p>}
          {result.wrong > 0 && <p className={styles.hint}>{t('earWrong', { count: result.wrong })}</p>}
          <div className={styles.actions}>
            <Button onClick={start}>{t('playAgain')}</Button>
            <Button variant="outline" onClick={() => morph(() => setPhase('setup'))}>
              {t('changeLevel')}
            </Button>
            <Button variant="ghost" onClick={() => navigate({ name: 'door', door: 'challenges' }, { replace: true })}>
              {t('backToChallenges')}
            </Button>
          </div>
        </section>
      )}

      <div className={`${songStyles.stage} ${styles.readStage}`}>
        {piece && (phase === 'play' || phase === 'between') && (
          <Score song={piece.song} notes={notes} practice={piece.practice} bar={bar} now={phase === 'play' ? nowIds : NO_KEYS} results={results} wrong={wrong} size="big" whole follow="now" beatMs={READ_BEAT_MS} ariaLabel={t('readAria', { n: number })} />
        )}
        <PlayKeyboard
          sound={!kb.connected}
          boxes={boxes}
          held={held}
          targets={keysLit}
          wrong={wrong}
          marker={phase === 'ready' ? MIDDLE_C : undefined}
          markerLabel={t('markerMiddleC')}
          right={right}
          badges={phase === 'play' && results.size === 0 ? badges : undefined}
          label={label}
          names={settings.keyNames}
          onPress={(p) => press(p, performance.now(), true)}
          onRelease={release}
        />
      </div>
    </main>
  )
}
