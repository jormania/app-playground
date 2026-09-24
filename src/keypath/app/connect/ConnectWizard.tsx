import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../../ds'
import { MIN_VELOCITY } from '../../engine'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { WebMidiConnection } from '../../midi/webMidiConnection'
import { celebrate } from '../celebrate/celebrate'
import { useApp } from '../context'
import { noteLabel, type StringKey } from '../i18n'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { connectKeyboard, useKeyboard } from './keyboard'
import { rememberKeyboard } from './remember'
import { currentStep, detectXiaomi, stateOf, STUCK_AFTER_MS, stepsFor, type SetupStep } from './setup'
import styles from './connect.module.css'

const TITLE: Record<Exclude<SetupStep, 'done'>, StringKey> = {
  browser: 'stepBrowser',
  otg: 'stepOtg',
  plug: 'stepPlug',
  allow: 'stepAllow',
  find: 'stepFind',
  play: 'stepPlay',
}

/**
 * "Connect the keyboard": the steps from KEYPATH.md §2, one at a time, each
 * checked before the next opens, so nobody reaches a song believing the
 * keyboard is connected when it isn't. The last step asks for a key press:
 * an open port isn't proof, a note arriving is.
 */
export function ConnectWizard() {
  const { t, settings, store, profile, log } = useApp()
  const [heard, setHeard] = useState<number | null>(null)
  const onEvent = useCallback((e: MidiEvent) => {
    if (e.type === 'noteon' && isPlayerChannel(e.channel) && e.velocity >= MIN_VELOCITY) setHeard(e.note)
  }, [])
  const kb = useKeyboard(onEvent)
  const [pre] = useState(() => WebMidiConnection.precheck())
  const [xiaomi, setXiaomi] = useState<boolean | null>(null)
  useEffect(() => {
    void detectXiaomi().then(setXiaomi)
  }, [])
  const [otg, setOtg] = useState(false)
  const [plugged, setPlugged] = useState(false)

  const access = pre !== 'idle' ? pre : kb.access
  const step = currentStep({ access, connected: kb.connected, xiaomi: !!xiaomi, otgConfirmed: otg, plugConfirmed: plugged, heard: heard !== null })

  // A step waiting on the keyboard shows what to check once it has waited long enough.
  const [stuckAt, setStuckAt] = useState<SetupStep | null>(null)
  useEffect(() => {
    const ms = STUCK_AFTER_MS[step]
    if (ms === undefined) return
    const id = setTimeout(() => setStuckAt(step), ms)
    return () => clearTimeout(id)
  }, [step])
  const stuck = stuckAt === step

  // Log where it ended: done, or the step someone gave up on.
  const started = useRef(0)
  const last = useRef({ step, done: false })
  useEffect(() => {
    started.current = performance.now()
  }, [])
  useEffect(() => {
    const first = !last.current.done && step === 'done'
    last.current = { step, done: last.current.done || step === 'done' }
    if (!first) return
    celebrate('connected')
    if (kb.name) void rememberKeyboard(store, kb.name)
    if (profile) void log.add(profile.id, { type: 'keyboard_setup', outcome: 'done', step, ms: Math.round(performance.now() - started.current) })
  }, [step, kb.name, store, profile, log])
  useEffect(
    () => () => {
      if (!last.current.done && profile) void log.add(profile.id, { type: 'keyboard_setup', outcome: 'left', step: last.current.step, ms: Math.round(performance.now() - started.current) })
    },
    [profile, log],
  )

  const leave = () => {
    if (history.length > 1) history.back()
    else navigate({ name: 'home' }, { replace: true })
  }

  const checking = pre === 'idle' && (kb.checking || xiaomi === null)
  const label = (p: number) => noteLabel(p, settings.noteNames, settings.language)

  const body = (s: SetupStep) => {
    switch (s) {
      case 'browser':
        return <p className={styles.problem}>{t(access === 'insecure' ? 'stepBrowserInsecure' : 'stepBrowserUnsupported')}</p>
      case 'otg':
        return (
          <>
            <p>{t('stepOtgBody')}</p>
            <div>
              <Button onClick={() => setOtg(true)}>{t('stepOtgDone')}</Button>
            </div>
          </>
        )
      case 'plug':
        return (
          <>
            <ol className={styles.substeps}>
              <li>{t('stepPlug1')}</li>
              <li>{t('stepPlug2')}</li>
              <li>{t('stepPlug3')}</li>
              <li>{t('stepPlug4')}</li>
            </ol>
            <div>
              <Button onClick={() => setPlugged(true)}>{t('stepPlugDone')}</Button>
            </div>
          </>
        )
      case 'allow':
        return access === 'denied' ? (
          <>
            <p className={styles.problem}>{t('stepAllowDenied')}</p>
            <div>
              <Button onClick={() => void connectKeyboard()}>{t('stepAllowRetry')}</Button>
            </div>
          </>
        ) : (
          <>
            <p>{t('stepAllowBody')}</p>
            <div>
              <Button onClick={() => void connectKeyboard()} disabled={access === 'requesting'}>
                {access === 'requesting' ? t('stepAllowWaiting') : t('stepAllowAsk')}
              </Button>
            </div>
          </>
        )
      case 'find':
        return (
          <>
            <p className={styles.waiting}>{t('stepFindLooking')}</p>
            {stuck && (
              <div className={styles.tips}>
                <p>{t('stepFindStuck')}</p>
                <ul>
                  <li>{t('stepFindTip1')}</li>
                  <li>{t('stepFindTip2')}</li>
                  <li>{t('stepFindTip3')}</li>
                  {!xiaomi && <li>{t('stepFindTip4')}</li>}
                </ul>
                <button type="button" className={styles.link} onClick={() => navigate({ name: 'diagnostics' })}>
                  {t('stepFindMore')}
                </button>
              </div>
            )}
          </>
        )
      case 'play':
        return (
          <>
            <p>{t('stepPlayBody')}</p>
            {stuck && <p className={styles.problem}>{t('stepPlayStuck')}</p>}
          </>
        )
      default:
        return null
    }
  }

  const detail = (s: SetupStep): string | null =>
    s === 'browser' ? t('stepBrowserOk') : s === 'find' && kb.name ? t('stepFindFound', { name: kb.name }) : null

  return (
    <main className={styles.screen}>
      <TopBar title={t('connectTitle')} />
      {checking ? (
        <p className={styles.waiting} role="status">
          {t('connectChecking')}
        </p>
      ) : (
        <>
          {step !== 'done' && <p className={styles.intro}>{t('connectIntro')}</p>}
          <ol className={styles.steps}>
            {stepsFor(!!xiaomi).map((s, i) => {
              const state = stateOf(s, step, !!xiaomi)
              const problem = state === 'current' && (s === 'browser' || (s === 'allow' && access === 'denied') || stuck)
              return (
                <li key={s} className={styles.step} data-state={state} data-problem={problem || undefined} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className={styles.badge} aria-hidden>
                    {state === 'done' ? '✓' : problem ? '!' : i + 1}
                  </span>
                  <div className={styles.stepBody}>
                    <h2 className={styles.stepTitle}>{t(TITLE[s as Exclude<SetupStep, 'done'>])}</h2>
                    {state === 'done' && detail(s) && <p className={styles.detail}>{detail(s)}</p>}
                    {state === 'current' && body(s)}
                  </div>
                </li>
              )
            })}
          </ol>
          {step === 'done' && (
            <section className={styles.done} role="status">
              <h2 className={styles.doneTitle}>✓ {t('connectDone')}</h2>
              <p>{t('connectDoneBody', { name: kb.name ?? '' })}</p>
              {heard !== null && <p className={styles.lastKey}>{t('connectLastKey', { note: label(heard) })}</p>}
              <div>
                <Button onClick={leave}>{t('connectGo')}</Button>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
