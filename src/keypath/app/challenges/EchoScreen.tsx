import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, SegmentedControl } from '../../../ds'
import { MIN_VELOCITY } from '../../engine'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { celebrate } from '../celebrate/celebrate'
import { useApp } from '../context'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { OutputChoice, useOutput } from '../studio/output'
import { Playback, realClock } from '../studio/playback'
import type { TakeNote } from '../studio/recorder'
import { ECHO_LEVEL_NAME } from './ChallengesHome'
import { RecordRepo, type ChallengeRecords } from './records'
import { beatMs, ECHO_BPM, ECHO_PATTERNS, ECHO_WINDOW_MS, judgeEcho, turnTimeline, type EchoLevel, type EchoResult } from './rhythm'
import styles from './challenges.module.css'

type Phase = 'setup' | 'turn' | 'result' | 'done'
/** What the turn is doing now, for the big label. */
type Cue = { kind: 'listen' } | { kind: 'countIn'; count: number } | { kind: 'go' }

const CLICK = 84 // C6: a count-in click, on the piano, so any keyboard can play it
const NOTE = 72 // C5: the rhythm itself
const ROUND = 5

/**
 * Rhythm echo: KeyPath plays a bar, she plays it back on any key. Four clicks,
 * the rhythm, four clicks, her bar; then each note is marked on time, early,
 * late or missed. Five rhythms a round.
 */
export function EchoScreen() {
  const { t, store, profile, log, settings } = useApp()
  const repo = useMemo(() => new RecordRepo(store), [store])
  const [records, setRecords] = useState<ChallengeRecords | null>(null)
  const [level, setLevel] = useState<EchoLevel>(1)
  const [phase, setPhase] = useState<Phase>('setup')
  const [index, setIndex] = useState(0)
  const [cue, setCue] = useState<Cue>({ kind: 'listen' })
  const [taps, setTaps] = useState<number[]>([])
  const [result, setResult] = useState<EchoResult | null>(null)
  const [passed, setPassed] = useState<boolean[]>([])
  const [newBest, setNewBest] = useState(false)

  const profileId = profile?.id ?? null
  const playback = useRef<Playback | null>(null)
  const turn = useRef<{ downbeat: number; end: number; start: number } | null>(null)
  const tapTimes = useRef<number[]>([])
  const roundStart = useRef(0)
  const headKeyPath = useRef<HTMLSpanElement>(null)
  const headYou = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (profileId) void repo.get(profileId).then(setRecords)
  }, [repo, profileId])

  // The keyboard's notes reach the latest tap() through a ref, so the listener never goes stale.
  const tapRef = useRef<(at: number) => void>(() => {})
  const onMidi = useCallback((e: MidiEvent) => {
    if (e.type === 'noteon' && isPlayerChannel(e.channel) && e.velocity >= MIN_VELOCITY) tapRef.current(e.time)
  }, [])
  const kb = useKeyboard(onMidi)
  const output = useOutput(kb)

  const pattern = ECHO_PATTERNS[level][index]
  const bpm = ECHO_BPM[level]
  const b = beatMs(bpm)

  /** Her taps count only once her bar is near: anything earlier is the rhythm itself, or an echo of it. */
  function tap(at: number) {
    const tn = turn.current
    if (!tn || at < tn.downbeat - ECHO_WINDOW_MS[settings.timing] || at > tn.end) return
    tapTimes.current.push(at)
    setTaps([...tapTimes.current])
  }
  tapRef.current = tap

  const play = useCallback(() => {
    playback.current?.stop()
    tapTimes.current = []
    setTaps([])
    setResult(null)
    // The whole turn as one take: clicks, the rhythm, clicks, then silence for her bar.
    const tl = turnTimeline(pattern, bpm, 0)
    const note = (at: number, pitch: number, velocity: number): TakeNote => ({ pitch, velocity, startMs: Math.round(at), durationMs: 120 })
    const notes = [
      ...tl.listenClicks.map((c) => note(c.at, CLICK, c.accent ? 110 : 70)),
      ...tl.notes.map((at) => note(at, NOTE, 100)),
      ...tl.yourClicks.map((c) => note(c.at, CLICK, c.accent ? 110 : 70)),
    ].sort((x, y) => x.startMs - y.startMs)
    const p = new Playback({ ms: Math.round(tl.end), notes, pedal: [] }, output.sink(), realClock)
    playback.current = p
    p.start()
    const origin = p.startedAt
    turn.current = { start: origin, downbeat: origin + tl.downbeat, end: origin + tl.end }
    setCue({ kind: 'listen' })
    setPhase('turn')
  }, [pattern, bpm, output])

  // One frame loop per turn: the big label, the playhead, and the end of her bar.
  useEffect(() => {
    if (phase !== 'turn') return
    let raf = 0
    let last = ''
    const frame = () => {
      const tn = turn.current
      if (!tn) return
      const now = performance.now()
      const beat = (now - tn.start) / b
      const next: Cue = beat < 8 ? { kind: 'listen' } : beat < 12 ? { kind: 'countIn', count: 4 - Math.floor(beat - 8) } : { kind: 'go' }
      const key = JSON.stringify(next)
      if (key !== last) {
        last = key
        setCue(next)
      }
      // The playhead crosses the KeyPath row during the rhythm, then her row during her bar.
      const place = (el: HTMLSpanElement | null, from: number) => {
        if (!el) return
        const inBar = beat >= from && beat < from + 4 ? beat - from : null
        el.style.opacity = inBar === null ? '0' : '1'
        el.style.left = `${((inBar ?? 0) / 4) * 100}%`
      }
      place(headKeyPath.current, 4)
      place(headYou.current, 12)
      if (now >= tn.end) {
        const r = judgeEcho(pattern, bpm, tn.downbeat, tapTimes.current, settings.timing)
        turn.current = null
        setResult(r)
        if (r.passed) celebrate('echoPassed')
        setPassed((ps) => {
          const copy = [...ps]
          copy[index] = copy[index] || r.passed
          return copy
        })
        setPhase('result')
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, b, pattern, bpm, index, settings.timing])

  const startRound = () => {
    setIndex(0)
    setPassed([])
    setNewBest(false)
    roundStart.current = performance.now()
    if (profileId) void log.add(profileId, { type: 'challenge_started', game: 'echo', level })
  }
  // A new round, or the next rhythm: play as soon as the index settles.
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (!pending) return
    setPending(false)
    play()
  }, [pending, play])

  const finishRound = async () => {
    const score = passed.filter(Boolean).length
    setPhase('done')
    if (!profileId) return
    const best = await repo.offer(profileId, 'echo', level, score)
    setNewBest(best)
    if (best) celebrate('newBest')
    setRecords(await repo.get(profileId))
    void log.add(profileId, { type: 'challenge_finished', game: 'echo', level, score, best, ms: Math.round(performance.now() - roundStart.current) })
  }

  // Leaving mid-turn stops the sound and is logged.
  useEffect(
    () => () => {
      playback.current?.stop()
      if (turn.current && profileId) void log.add(profileId, { type: 'challenge_left', game: 'echo', level, ms: Math.round(performance.now() - roundStart.current) })
    },
    [log, profileId, level],
  )

  const best = records?.echo[level]
  const cueText = cue.kind === 'listen' ? t('echoListen') : cue.kind === 'countIn' ? t('echoYourTurn', { count: cue.count }) : t('echoGo')
  const score = passed.filter(Boolean).length
  const showRows = phase === 'turn' || phase === 'result'
  const tn = turn.current

  return (
    <main className={`${styles.playScreen} ${styles.echoScreen}`}>
      <TopBar title={t('echoTitle')} aside={<KeyboardStatus status={kb} missing="keyboardMissing" />} />

      {phase === 'setup' && (
        <section className={styles.panel}>
          <p>{t('echoBlurb')}</p>
          <div className={styles.row}>
            <span className={styles.label}>{t('level')}</span>
            <SegmentedControl
              size="sm"
              value={String(level)}
              onChange={(v) => setLevel(Number(v) as EchoLevel)}
              options={[1, 2, 3].map((l) => ({ value: String(l), label: t(ECHO_LEVEL_NAME[l]) }))}
            />
          </div>
          <p className={styles.hint}>{best !== undefined ? t('best', { score: `${best}/${ROUND}` }) : t('noBest')}</p>
          <OutputChoice output={output} label={t('echoPlayOn')} phoneOnly={t('echoPlaysOnPhone')} />
          <div>
            <Button
              onClick={() => {
                startRound()
                setPending(true)
              }}
            >
              ▶ {t('go')}
            </Button>
          </div>
        </section>
      )}

      {showRows && (
        <section className={styles.echo}>
          <p className={styles.echoCount}>{t('echoPattern', { n: index + 1 })}</p>
          <p className={styles.echoCue} role="status" data-go={(phase === 'turn' && cue.kind === 'go') || undefined}>
            {phase === 'turn' ? cueText : result?.passed ? `✓ ${t('echoPassed')}` : t('echoMissed')}
          </p>
          <div className={styles.bars}>
            <span className={styles.rowLabel}>{t('echoKeyPath')}</span>
            <div className={styles.bar}>
              {[0, 1, 2, 3].map((beat) => (
                <span key={beat} className={styles.beatLine} style={{ left: `${(beat / 4) * 100}%` }} />
              ))}
              {pattern.map((beat, i) => (
                <span key={i} className={styles.dot} data-verdict={result?.marks[i].verdict} style={{ left: `${(beat / 4) * 100}%` }} />
              ))}
              <span ref={headKeyPath} className={styles.playhead} aria-hidden />
            </div>
            <span className={styles.rowLabel}>{t('echoYou')}</span>
            <div className={styles.bar}>
              {[0, 1, 2, 3].map((beat) => (
                <span key={beat} className={styles.beatLine} style={{ left: `${(beat / 4) * 100}%` }} />
              ))}
              {tn &&
                taps
                  .filter((at) => at >= tn.downbeat - ECHO_WINDOW_MS[settings.timing])
                  .map((at, i) => <span key={i} className={styles.tapMark} style={{ left: `${(Math.max(0, at - tn.downbeat) / (4 * b)) * 100}%` }} />)}
              {result &&
                result.marks
                  .filter((m) => m.deltaMs !== null)
                  .map((m, i) => (
                    <span key={i} className={styles.tapMark} data-verdict={m.verdict} style={{ left: `${Math.min(100, Math.max(0, ((m.beat * b + m.deltaMs!) / (4 * b)) * 100))}%` }} />
                  ))}
              <span ref={headYou} className={styles.playhead} aria-hidden />
            </div>
          </div>
          {result && result.extra > 0 && <p className={styles.hint}>{t('echoExtra', { count: result.extra })}</p>}
        </section>
      )}

      {phase === 'result' && (
        <div className={styles.actions}>
          {!result?.passed && <Button onClick={play}>{t('echoAgain')}</Button>}
          {index + 1 < ROUND ? (
            <Button
              variant={result?.passed ? 'primary' : 'outline'}
              onClick={() => {
                setIndex((i) => i + 1)
                setPending(true)
              }}
            >
              {t('echoNext')}
            </Button>
          ) : (
            <Button variant={result?.passed ? 'primary' : 'outline'} onClick={() => void finishRound()}>
              {t('echoRoundEnd')}
            </Button>
          )}
        </div>
      )}

      {phase === 'done' && (
        <section className={styles.panel} role="status">
          <h2 className={styles.resultTitle}>{t('echoRoundDone', { score })}</h2>
          {newBest && <p className={styles.newBest}>★ {t('newBest')}</p>}
          <div className={styles.actions}>
            <Button
              onClick={() => {
                startRound()
                setPending(true)
              }}
            >
              {t('playAgain')}
            </Button>
            <Button variant="outline" onClick={() => setPhase('setup')}>
              {t('changeLevel')}
            </Button>
            <Button variant="ghost" onClick={() => navigate({ name: 'door', door: 'challenges' }, { replace: true })}>
              {t('backToChallenges')}
            </Button>
          </div>
        </section>
      )}

      {phase === 'turn' && (
        <button
          type="button"
          className={styles.tapPad}
          onPointerDown={(e) => {
            e.preventDefault()
            tap(performance.now())
          }}
        >
          {t('echoTap')}
        </button>
      )}
    </main>
  )
}
