import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../ds'
import { MIN_VELOCITY, octaveShift, type NoteResult } from '../../engine'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { celebrate } from '../celebrate/celebrate'
import { useApp } from '../context'
import { noteLabel } from '../i18n'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { FallingNotes, type FallingNotesHandle } from '../songs/FallingNotes'
import { keyBoxes, widenRange } from '../songs/keyGeometry'
import { useWide, WIDE_OCTAVES } from '../songs/useWide'
import { PlayKeyboard } from '../songs/PlayKeyboard'
import { Tune, type Exercise, type ExerciseView, type Say } from './exercises'
import { Hands } from './Hands'
import { JourneyRepo, stateOf, type JourneyProgress } from './progress'
import { Staff } from './Staff'
import { JOURNEY, stepById, type JourneyStep } from './steps'
import styles from './journey.module.css'

type Mode = 'practice' | 'check'
type Phase = 'intro' | 'gate' | 'run' | 'result'

const MIDDLE_C = 60
const FLASH_MS = 350

export function StepScreen({ stepId }: { stepId: string }) {
  const { store, profile } = useApp()
  const step = stepById(stepId)
  const repo = useMemo(() => new JourneyRepo(store), [store])
  const [progress, setProgress] = useState<JourneyProgress | null>(null)
  useEffect(() => {
    if (profile) void repo.get(profile.id).then(setProgress)
  }, [repo, profile])
  useEffect(() => {
    if (!step) navigate({ name: 'door', door: 'journey' }, { replace: true })
  }, [step])
  if (!step || !progress || !profile) return null
  return <Step key={step.id} step={step} progress={progress} onProgress={setProgress} repo={repo} profileId={profile.id} />
}

interface StepProps {
  step: JourneyStep
  progress: JourneyProgress
  onProgress: (p: JourneyProgress) => void
  repo: JourneyRepo
  profileId: string
}

function Step({ step, progress, onProgress, repo, profileId }: StepProps) {
  const { t, settings, log, updateSetting } = useApp()
  const n = JOURNEY.indexOf(step) + 1
  const state = stateOf(progress, step.id)
  const [phase, setPhase] = useState<Phase>('intro')
  const [mode, setMode] = useState<Mode>('practice')
  const [view, setView] = useState<ExerciseView | null>(null)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [wrong, setWrong] = useState<ReadonlySet<number>>(new Set())
  const [note, setNote] = useState<string | null>(null)
  const [passed, setPassed] = useState<{ ok: boolean; testOut: boolean } | null>(null)
  const [played, setPlayed] = useState<ReadonlyMap<number, NoteResult['outcome']>>(new Map())
  const [keyNamesAnswered, setKeyNamesAnswered] = useState(false)

  const exercise = useRef<Exercise | null>(null)
  const shift = useRef(0)
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase
  const startedAt = useRef(0)
  const fall = useRef<FallingNotesHandle>(null)

  const wide = useWide()
  const boxes = useMemo(() => {
    const r = wide ? widenRange(step.range, WIDE_OCTAVES) : step.range
    return keyBoxes(r.low, r.high)
  }, [step, wide])
  const label = useCallback((p: number) => noteLabel(p, settings.noteNames, settings.language), [settings.noteNames, settings.language])
  const say = (s: Say) => {
    const [a, b, c] = (s.notes ?? []).map(label)
    return t(s.key, { ...s.vars, note: a ?? '', note2: b ?? '', note3: c ?? '' })
  }

  const run = useCallback(() => {
    const ex = mode === 'practice' ? step.practice(settings.timing) : step.check(settings.timing)
    exercise.current = ex
    setView(ex.view())
    setPlayed(new Map())
    setNote(null)
    startedAt.current = performance.now()
    setPhase('run')
  }, [mode, step, settings.timing])

  const begin = (m: Mode) => {
    exercise.current = null
    setMode(m)
    setPassed(null)
    void log.add(profileId, { type: 'journey_started', step: step.id, mode: m, testOut: m === 'check' && state === 'locked' })
    setPhase(step.octaveGate ? 'gate' : 'run')
  }
  // Entering 'run' from intro or the gate builds a fresh exercise for the chosen mode.
  useEffect(() => {
    if (phase === 'run' && !exercise.current) run()
  }, [phase, run])

  const finish = useCallback(async () => {
    const ex = exercise.current
    if (!ex) return
    const ms = Math.round(performance.now() - startedAt.current)
    const ok = mode === 'practice' || ex.wrong <= step.allowWrong
    const testOut = state === 'locked'
    void log.add(profileId, { type: 'journey_finished', step: step.id, mode, passed: ok, wrong: ex.wrong, ms })
    if (mode === 'check' && ok) {
      const next = await repo.pass(profileId, step.id)
      onProgress(next)
      celebrate(JOURNEY.every((x) => next[x.id]) ? 'journeyDone' : 'stepPassed')
    }
    setPassed({ ok, testOut })
    setPhase('result')
  }, [mode, step, state, log, profileId, repo, onProgress])

  const flashWrong = (p: number) => {
    setWrong((w) => new Set(w).add(p))
    setTimeout(() => setWrong((w) => { const s = new Set(w); s.delete(p); return s }), FLASH_MS)
  }

  /** A key down, as drawn on screen (the octave shift already applied to the Yamaha's notes). */
  const press = useCallback(
    (drawn: number, at: number, fromScreen: boolean) => {
      setHeld((h) => new Set(h).add(drawn))
      if (phaseRef.current === 'gate') {
        const found = fromScreen ? (drawn === MIDDLE_C ? 0 : null) : octaveShift(drawn, MIDDLE_C)
        if (found === null) return setNote(t('notAC', { note: label(drawn) }))
        shift.current = found
        setHeld(new Set())
        exercise.current = null
        setPhase('run')
        return
      }
      const ex = exercise.current
      if (phaseRef.current !== 'run' || !ex || ex.finished) return
      const outcome = ex.press(drawn, at)
      if (outcome === 'wrong') flashWrong(drawn)
      setNote(outcome === 'spread' ? t('jSpread') : null)
      setView(ex.view())
      if (ex instanceof Tune) setPlayed(new Map([...ex.played()].map((id) => [id, 'hit' as const])))
      if (ex.finished) void finish()
    },
    [t, label, finish],
  )
  const release = useCallback((drawn: number) => {
    setHeld((h) => { const s = new Set(h); s.delete(drawn); return s })
    exercise.current?.release(drawn)
  }, [])

  const onMidi = useCallback(
    (e: MidiEvent) => {
      if ((e.type !== 'noteon' && e.type !== 'noteoff') || !isPlayerChannel(e.channel)) return
      if (e.type === 'noteoff') return release(e.note + shift.current)
      if (e.velocity < MIN_VELOCITY) return
      // Before the gate the shift is unknown; the gate itself works it out from this key.
      press(phaseRef.current === 'gate' ? e.note : e.note + shift.current, e.time, false)
    },
    [press, release],
  )
  const keyboard = useKeyboard(onMidi)

  // Leaving mid-exercise is logged, so the map shows where attention ran out.
  const modeRef = useRef(mode)
  modeRef.current = mode
  useEffect(
    () => () => {
      if (phaseRef.current === 'run' || phaseRef.current === 'gate')
        void log.add(profileId, { type: 'journey_left', step: step.id, mode: modeRef.current, ms: Math.round(performance.now() - startedAt.current) })
    },
    [log, profileId, step.id],
  )

  // Tunes: the falling notes glide to the note being waited on.
  const tune = phase === 'run' && exercise.current instanceof Tune ? exercise.current : null
  useEffect(() => {
    if (!tune || step.staff) return
    let raf = 0
    let shown = -1500
    const frame = () => {
      const target = tune.step?.startMs ?? shown
      shown += (target - shown) * 0.2
      fall.current?.setTime(shown)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [tune, step.staff])

  // Reading the staff is the moment to try the keys without their names:
  // offered once she passes step 6's check, applied only on a Yes.
  const offerKeyNamesOff = phase === 'result' && mode === 'check' && !!passed?.ok && step.id === 'notation' && settings.keyNames && !keyNamesAnswered
  const answerKeyNames = async (accepted: boolean) => {
    setKeyNamesAnswered(true)
    void log.add(profileId, { type: 'suggestion', setting: 'keyNames', to: 'off', accepted, step: step.id })
    if (accepted) await updateSetting('keyNames', false)
  }

  const hands = (active?: ExerciseView['finger']) => (
    <Hands active={active} ariaLabel={t('jFingersAria')} leftLabel={t('handLeft')} rightLabel={t('handRight')} />
  )

  const next = JOURNEY[n] ?? null
  const targets = phase === 'gate' ? new Set([MIDDLE_C]) : new Set(view?.targets ?? [])

  return (
    <main className={styles.stepScreen}>
      <TopBar title={`${t('jStepN', { n })} · ${t(step.title)}`} aside={<KeyboardStatus status={keyboard} missing="keyboardMissing" />} />

      {phase === 'intro' && (
        <section className={styles.panel}>
          <p className={styles.blurb}>{t(step.blurb)}</p>
          {step.id === 'fingers' && hands()}
          <p className={styles.tip}>{t(step.tip)}</p>
          {state === 'locked' ? (
            <>
              <p className={styles.hint}>{t('jLocked', { n: n - 1 })}</p>
              <div className={styles.actions}>
                <Button onClick={() => begin('check')}>{t('jTestOut')}</Button>
              </div>
            </>
          ) : (
            <div className={styles.actions}>
              <Button onClick={() => begin('practice')}>{t('jLearn')}</Button>
              <Button variant="outline" onClick={() => begin('check')}>
                {t('jCheck')}
              </Button>
            </div>
          )}
        </section>
      )}

      {phase === 'gate' && (
        <div className={styles.prompt} role="status">
          <strong>{t('pressMiddleC')}</strong>
          <span>{note ?? t('pressMiddleCHint')}</span>
        </div>
      )}

      {phase === 'run' && view && (
        <div className={styles.prompt} role="status">
          <strong>{say(view.say)}</strong>
          <span className={styles.progress} aria-label={`${view.done} / ${view.total}`}>
            {Array.from({ length: view.total }, (_, i) => (
              <span key={i} data-done={i < view.done || undefined} />
            ))}
          </span>
          {note && <span className={styles.spread}>{note}</span>}
        </div>
      )}

      {phase === 'result' && passed && (
        <section className={styles.panel} role="status">
          <h2 className={styles.resultTitle} data-ok={passed.ok || undefined}>
            {mode === 'practice' ? t('jPracticeDone') : passed.ok ? t(passed.testOut ? 'jPassedTestOut' : 'jPassed') : t('jNotYet')}
          </h2>
          {offerKeyNamesOff && (
            <div className={styles.suggestion}>
              <p>{t('jSuggestKeyNames')}</p>
              <div className={styles.actions}>
                <Button size="sm" onClick={() => void answerKeyNames(true)}>
                  {t('yesChange')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void answerKeyNames(false)}>
                  {t('notNow')}
                </Button>
              </div>
            </div>
          )}
          <div className={styles.actions}>
            {mode === 'practice' && <Button onClick={() => begin('check')}>{t('jCheck')}</Button>}
            {mode === 'check' && passed.ok && next && <Button onClick={() => navigate({ name: 'journeyStep', step: next.id }, { replace: true })}>{t('jNext')}</Button>}
            {mode === 'check' && !passed.ok && (
              <>
                <Button onClick={() => begin('check')}>{t('jTryAgain')}</Button>
                <Button variant="outline" onClick={() => begin('practice')}>
                  {t('jPractiseFirst')}
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => navigate({ name: 'door', door: 'journey' }, { replace: true })}>
              {t('jMap')}
            </Button>
          </div>
        </section>
      )}

      {(phase === 'gate' || phase === 'run') && (
        <div className={styles.stage}>
          {/* The finger-numbers step: the hands, the finger asked for lit (the practice only; the check asks from memory). */}
          {step.id === 'fingers' && phase === 'run' && mode === 'practice' && hands(view?.finger)}
          {tune && step.staff && (
            <Staff
              notes={mode === 'practice' ? step.staff.practice : step.staff.check}
              current={tune.step?.index ?? -1}
              played={new Set(played.keys())}
              label={mode === 'practice' ? label : undefined}
              fingers={mode === 'practice' && settings.fingers ? tune.notes.map((x) => x.finger) : undefined}
              ariaLabel={mode === 'practice' ? step.staff.practice.map(([p]) => label(p)).join(' ') : t('j6Title')}
            />
          )}
          {tune && !step.staff && <FallingNotes ref={fall} notes={tune.notes} boxes={boxes} results={played} label={label} fingers={settings.fingers} />}
          <PlayKeyboard
            sound={!keyboard.connected}
            names={settings.keyNames}
            boxes={boxes}
            held={held}
            targets={targets}
            wrong={wrong}
            marker={phase === 'gate' ? MIDDLE_C : undefined}
            label={label}
            onPress={(p) => press(p, performance.now(), true)}
            onRelease={release}
          />
        </div>
      )}
    </main>
  )
}
