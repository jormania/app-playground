import { useState } from 'react'
import { Button, Field, TextAreaField } from '../../ds'
import type { Thing } from '../lib/notion'
import type { Provocation } from '../lib/provocations'
import styles from './ProvocationBanner.module.css'

export interface ProvocationBannerProps {
  provocation: Provocation
  onDismiss: () => void
  onAcceptPair: (a: Thing, b: Thing, why: string) => void
  onAcceptClearingForming: (things: Thing[], name: string) => void
}

function summarize(thing: Thing, max = 120): string {
  return thing.body.length > max ? `${thing.body.slice(0, max)}…` : thing.body
}

const KIND_LABEL: Record<Provocation['kind'], string> = {
  shuffle: 'From the forest',
  'random-clearing': 'A clearing, revisited',
  'long-unvisited': 'Not looked at in a while',
  'blind-pairing': 'Two things, side by side',
  'near-neighbours': 'These grew near each other',
  'clearing-forming': 'A clearing may be forming',
  tension: 'These may pull in different directions',
}

/** The app's only voice (SILVA.md "Provocations") — places things beside
 *  each other and stops talking. Never explains the connection; the
 *  human writes the Why if they accept one. At most one is ever shown per
 *  session (enforced by the caller, not here). */
export function ProvocationBanner({ provocation, onDismiss, onAcceptPair, onAcceptClearingForming }: ProvocationBannerProps) {
  const [respondingWhy, setRespondingWhy] = useState(false)
  const [respondingName, setRespondingName] = useState(false)
  const [why, setWhy] = useState('')
  const [name, setName] = useState('')

  return (
    <div className={styles.banner}>
      <p className={styles.kindLabel}>{KIND_LABEL[provocation.kind]}</p>

      {provocation.kind === 'shuffle' && (
        <p className={styles.body}>{summarize(provocation.thing, 220)}</p>
      )}

      {provocation.kind === 'long-unvisited' && (
        <p className={styles.body}>{summarize(provocation.thing, 220)}</p>
      )}

      {provocation.kind === 'random-clearing' && (
        <>
          <p className={styles.locusName}>{provocation.locus.name}</p>
          {provocation.locus.meaning && <p className={styles.meaning}>{provocation.locus.meaning}</p>}
          <ul className={styles.thingList}>
            {provocation.things.map((t) => <li key={t.id}>{summarize(t, 90)}</li>)}
          </ul>
        </>
      )}

      {(provocation.kind === 'blind-pairing' || provocation.kind === 'near-neighbours' || provocation.kind === 'tension') && (
        <div className={styles.pair}>
          <p className={styles.body}>{summarize(provocation.a)}</p>
          <p className={styles.body}>{summarize(provocation.b)}</p>
        </div>
      )}

      {provocation.kind === 'clearing-forming' && (
        <ul className={styles.thingList}>
          {provocation.things.map((t) => <li key={t.id}>{summarize(t, 90)}</li>)}
        </ul>
      )}

      {respondingWhy && (provocation.kind === 'blind-pairing' || provocation.kind === 'near-neighbours' || provocation.kind === 'tension') ? (
        <div className={styles.respond}>
          <TextAreaField
            label="What did you see between them?"
            hint="Required — this becomes the path's record."
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            rows={3}
          />
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={() => setRespondingWhy(false)}>Back</Button>
            <Button
              size="sm"
              disabled={!why.trim()}
              onClick={() => onAcceptPair(provocation.a, provocation.b, why.trim())}
            >
              Walk this path
            </Button>
          </div>
        </div>
      ) : respondingName && provocation.kind === 'clearing-forming' ? (
        <div className={styles.respond}>
          <Field
            label="What do you call this clearing?"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={() => setRespondingName(false)}>Back</Button>
            <Button
              size="sm"
              disabled={!name.trim()}
              onClick={() => onAcceptClearingForming(provocation.things, name.trim())}
            >
              Coin this clearing
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            {provocation.kind === 'blind-pairing' || provocation.kind === 'near-neighbours' || provocation.kind === 'tension' || provocation.kind === 'clearing-forming'
              ? 'Not really'
              : 'Dismiss'}
          </Button>
          {(provocation.kind === 'blind-pairing' || provocation.kind === 'near-neighbours' || provocation.kind === 'tension') && (
            <Button size="sm" onClick={() => setRespondingWhy(true)}>I see it too</Button>
          )}
          {provocation.kind === 'clearing-forming' && (
            <Button size="sm" onClick={() => setRespondingName(true)}>Coin a clearing from these</Button>
          )}
        </div>
      )}
    </div>
  )
}
