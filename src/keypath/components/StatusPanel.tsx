import { Button } from '../../ds'
import type { ConnectionSnapshot } from '../midi/types'
import type { EnvironmentFacts } from '../probe/environment'
import type { UsbFinding } from '../probe/usb'
import styles from './probe.module.css'

type Tone = 'ok' | 'bad' | 'unknown'

function Row({ label, tone, value }: { label: string; tone: Tone; value: string }) {
  return (
    <div className={styles.statusRow}>
      <span className={`${styles.dot} ${styles[tone]}`} aria-hidden />
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusValue}>{value}</span>
    </div>
  )
}

const ACCESS_TEXT: Record<ConnectionSnapshot['access'], string> = {
  idle: 'Not requested yet',
  requesting: 'Waiting for permission…',
  granted: 'Granted',
  denied: 'Denied',
  unsupported: 'This browser has no Web MIDI',
  insecure: 'Blocked: page is not a secure context (needs HTTPS or localhost)',
}

export interface StatusPanelProps {
  simulated: boolean
  connection: ConnectionSnapshot
  env: EnvironmentFacts | null
  usb: UsbFinding | null
  onConnect: () => void
  onLookUsb: () => void
}

export function StatusPanel({ simulated, connection, env, usb, onConnect, onLookUsb }: StatusPanelProps) {
  const inputs = connection.inputs.filter((d) => d.state === 'connected')
  const yamaha = inputs.find((d) => d.looksLikeYamaha)
  const granted = connection.access === 'granted'

  const usbTone: Tone = usb?.state === 'found' ? 'ok' : usb?.state === 'not-found' || usb?.state === 'error' ? 'bad' : 'unknown'
  const usbText = !usb
    ? 'Not checked'
    : usb.device
      ? `${usb.device.manufacturer || 'Yamaha'} ${usb.device.name} (${usb.device.vendorId}:${usb.device.productId})`
      : usb.note

  return (
    <section className={styles.panel} aria-label="Connection status">
      <h2 className={styles.h2}>Connection</h2>
      {!simulated && (
        <>
          <Row label="Secure context" tone={env ? (env.secureContext ? 'ok' : 'bad') : 'unknown'} value={env ? (env.secureContext ? 'Yes' : 'No — Web MIDI is withheld') : '…'} />
          <Row label="Web MIDI API" tone={env ? (env.webMidi ? 'ok' : 'bad') : 'unknown'} value={env ? (env.webMidi ? 'Present' : 'Absent') : '…'} />
          <Row label="USB device" tone={usbTone} value={usbText} />
        </>
      )}
      <Row label="MIDI access" tone={granted ? 'ok' : connection.access === 'idle' || connection.access === 'requesting' ? 'unknown' : 'bad'} value={connection.error ?? ACCESS_TEXT[connection.access]} />
      <Row
        label="MIDI input"
        tone={!granted ? 'unknown' : inputs.length ? 'ok' : 'bad'}
        value={!granted ? '—' : inputs.length ? inputs.map((d) => [d.manufacturer, d.name].filter(Boolean).join(' · ')).join(', ') : 'None detected'}
      />
      {!simulated && (
        <Row
          label="Yamaha PSR-E383"
          tone={!granted ? 'unknown' : yamaha ? 'ok' : inputs.length ? 'unknown' : 'bad'}
          value={!granted ? '—' : yamaha ? `Identified: “${yamaha.name}”` : inputs.length ? 'Not identified by name — press a key; any input that sends notes works' : 'Not detected'}
        />
      )}
      <div className={styles.actions}>
        {connection.access !== 'granted' && (
          <Button onClick={onConnect} disabled={connection.access === 'requesting'}>
            {simulated ? 'Start simulator' : 'Connect MIDI'}
          </Button>
        )}
        {!simulated && env?.webUsb && usb?.state !== 'found' && (
          <Button variant="outline" onClick={onLookUsb}>
            Look on USB
          </Button>
        )}
      </div>
    </section>
  )
}
