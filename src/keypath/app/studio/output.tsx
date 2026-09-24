import { useCallback, useEffect, useState } from 'react'
import { SegmentedControl } from '../../../ds'
import { loadOutputLevel } from '../../probe/outputLevel'
import { keyboardConnection, type KeyboardStatus } from '../connect/keyboard'
import { useApp } from '../context'
import { PREFIX } from '../store'
import type { Sink } from './playback'
import { keyboardSink, phoneSink } from './sinks'
import styles from './studio.module.css'

export type Via = 'keyboard' | 'phone'
/** Where KeyPath's own sound goes, chosen once per phone (Studio's takes, Challenges' rhythms). */
const VIA_KEY = `${PREFIX}studioVia`

export interface Output {
  /** What she chose; used when the keyboard can take MIDI. */
  via: Via
  choose: (v: Via) => void
  /** A keyboard with a MIDI output is attached. */
  canSend: boolean
  /** Where sound actually goes now. */
  route: Via
  sink: () => Sink
  /** The phone plays, through the keyboard bus, whose level is still 0: nothing will be heard. */
  phoneMuted: boolean
}

/**
 * The keyboard over MIDI out when it's there and she hasn't chosen the phone;
 * otherwise the phone (through the "sound through the keyboard" level while
 * the Yamaha is attached, since Android may send phone audio to it).
 */
export function useOutput(kb: KeyboardStatus): Output {
  const { store } = useApp()
  const [via, setVia] = useState<Via>('keyboard')
  useEffect(() => {
    void store.get<Via>(VIA_KEY).then((v) => v && setVia(v))
  }, [store])
  const choose = useCallback(
    (v: Via) => {
      setVia(v)
      void store.set(VIA_KEY, v)
    },
    [store],
  )
  const canSend = kb.connected && !!kb.snapshot.outputs?.some((o) => o.state === 'connected')
  const route: Via = canSend ? via : 'phone'
  const sink = useCallback((): Sink => (route === 'keyboard' ? keyboardSink((d, at) => keyboardConnection().send?.(d, at) ?? false) : phoneSink(kb.connected)), [route, kb.connected])
  const phoneMuted = route === 'phone' && kb.connected && loadOutputLevel().level === 0
  return { via, choose, canSend, route, sink, phoneMuted }
}

/** The Keyboard / Phone choice, or a line saying the phone plays when there is no choice. */
export function OutputChoice({ output, label, phoneOnly }: { output: Output; label: string; phoneOnly: string }) {
  const { t } = useApp()
  return (
    <>
      {output.canSend ? (
        <div className={styles.via}>
          <span className={styles.hint}>{label}</span>
          <SegmentedControl
            size="sm"
            value={output.via}
            onChange={(v) => output.choose(v as Via)}
            options={[
              { value: 'keyboard', label: t('studioOnKeyboard') },
              { value: 'phone', label: t('studioOnPhone') },
            ]}
          />
        </div>
      ) : (
        <p className={styles.hint}>{phoneOnly}</p>
      )}
      {output.phoneMuted && <p className={styles.hint}>{t('studioPhoneMuted')}</p>}
    </>
  )
}
