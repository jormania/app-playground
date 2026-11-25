/**
 * The welcome tour: seven short steps, shown the first time InFlow opens.
 * The checkbox on every step decides whether it comes back next time; it
 * starts ticked on first run, and Settings can always bring the tour back.
 * Steps that introduce an optional feature carry its switch.
 */
import { useState } from 'react'
import { Check, Database, DoorOpen, Flame, PlusCircle, Receipt, Scale, Waves } from 'lucide-react'
import type { FeatureKey } from '../domain/types'
import { Button, Modal } from '../../ds'
import { useInflow } from '../app/state'
import styles from '../styles/ui.module.css'

interface Step {
  icon: typeof Waves
  title: string
  /** Two to four short points, read at a glance. */
  points: string[]
  /** A feature this step introduces, switchable right here. */
  feature?: { key: FeatureKey; label: string }
}

const STEPS: Step[] = [
  {
    icon: Waves,
    title: 'Welcome to InFlow',
    points: ['How much came in, and from whom', 'Where the work happened', 'What you actually keep', 'Not accounting software — just the picture'],
  },
  {
    icon: PlusCircle,
    title: 'Add a payment in seconds',
    points: ['Tap “Add income”, type the amount, pick the client', 'The rest is filled in from their last payment', 'Your usual amounts are one tap away', 'Foreign currencies are converted to lei'],
  },
  {
    icon: Flame,
    title: 'Where the money is good',
    points: ['Reports → Clients & work ranks by what you kept', 'The Review maps the period: totals, rises, drops', 'Pain points in plain words; 👍 or 👎 each one'],
    feature: { key: 'insights', label: 'Insights' },
  },
  {
    icon: DoorOpen,
    title: 'Fixed fee or a share?',
    points: ['Each venue’s deal: a fee per session, or a share', 'What every room leaves you, side by side', 'Break-even: how many people cover the fee', 'What if: the same sessions on other terms'],
    feature: { key: 'deals', label: 'Venue deals' },
  },
  {
    icon: Scale,
    title: 'Costs and profit',
    points: ['Record what you spend', 'P&L and monthly cash flow', 'Your break-even each month'],
    feature: { key: 'costs', label: 'Costs, P&L and cash flow' },
  },
  {
    icon: Receipt,
    title: 'Tax, only if you want it',
    points: ['Taxable or not, withheld or not, VAT', 'What to set aside, under Romanian rules', 'Always a suggestion; you decide'],
    feature: { key: 'tax', label: 'Tax suggestions' },
  },
  {
    icon: Database,
    title: 'Your data, your choice',
    points: ['You start simple; tick a feature above to add it', 'Settings → Features: one by one, or “Everything”', 'The demo lives apart from your data', 'On this device, or in your Notion'],
  },
]

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, workspace, setWorkspace } = useInflow()
  const [step, setStep] = useState(0)
  const [again, setAgain] = useState(settings.showTour)
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  const finish = () => {
    updateSettings({ showTour: again })
    setStep(0)
    onClose()
  }

  return (
    <Modal open={open} onClose={finish} title={`${step + 1} of ${STEPS.length}`}>
      <div className={styles.tourStep}>
        <div className={styles.tourIcon}><s.icon size={26} aria-hidden /></div>
        <h3 className={styles.tourTitle}>{s.title}</h3>
        <ul className={styles.tourPoints}>
          {s.points.map((p) => <li key={p}><Check size={14} aria-hidden />{p}</li>)}
        </ul>
        {s.feature && (
          <label className={styles.tourCheck}>
            <input type="checkbox" checked={settings.features[s.feature.key]}
              onChange={(e) => updateSettings({ features: { [s.feature!.key]: e.target.checked } })} />
            {s.feature.label} (optional)
          </label>
        )}
      </div>
      <div className={styles.tourDots} aria-hidden>
        {STEPS.map((_, i) => <span key={i} className={`${styles.tourDot} ${i === step ? styles.tourDotOn : ''}`} />)}
      </div>
      <label className={styles.tourCheck}>
        <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} />
        Show this guide next time I open InFlow
      </label>
      <div className={styles.tourActions}>
        <div><Button variant="ghost" onClick={finish}>Skip</Button></div>
        <div>
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
          {last && workspace === 'demo' && <Button variant="secondary" onClick={() => { setWorkspace('mine'); finish() }}>Start with my data</Button>}
          <Button onClick={() => (last ? finish() : setStep(step + 1))}>{last ? (workspace === 'demo' ? 'Explore the demo' : 'Start') : 'Next'}</Button>
        </div>
      </div>
    </Modal>
  )
}
