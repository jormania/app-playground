/**
 * The welcome tour: seven short steps, shown the first time InFlow opens.
 * The checkbox on every step decides whether it comes back next time; it
 * starts ticked on first run, and Settings can always bring the tour back.
 * Steps that introduce an optional feature carry its switch.
 */
import { useState } from 'react'
import { Database, DoorOpen, Flame, PlusCircle, Receipt, Scale, Waves } from 'lucide-react'
import type { FeatureKey } from '../domain/types'
import { Button, Modal } from '../../ds'
import { useInflow } from '../app/state'
import styles from '../styles/ui.module.css'

interface Step {
  icon: typeof Waves
  title: string
  text: string
  /** A feature this step introduces, switchable right here. */
  feature?: { key: FeatureKey; label: string }
}

const STEPS: Step[] = [
  {
    icon: Waves,
    title: 'Welcome to InFlow',
    text: 'A light way to see your freelance income: how much came in, who it came from, where the work happened, and which of it is worth keeping. Not accounting software — just the picture.',
  },
  {
    icon: PlusCircle,
    title: 'Add a payment in seconds',
    text: 'Tap “Add income”, type the amount, pick the client. InFlow remembers the rest from that client’s last payment — source, venue, currency — and converts foreign currencies to lei. New clients, sources and venues can be created right inside the form.',
  },
  {
    icon: Flame,
    title: 'Where the money is good',
    text: 'Reports break income down by client, venue, activity and source. Insights goes further: a heat map of what each kind of work leaves you, venue by venue, and plain-language pain points — sessions that lost money, clients drifting away, one-off clients who never came back.',
    feature: { key: 'insights', label: 'Insights and heat map' },
  },
  {
    icon: DoorOpen,
    title: 'Fixed fee or a share?',
    text: 'Some rooms charge a fee whoever turns up; others take a share of the tickets. Set each venue’s deal and note how many came, and InFlow shows how full a room must be, the evenings that cost you money, and which deal would have left you more.',
    feature: { key: 'deals', label: 'Venue deals' },
  },
  {
    icon: Scale,
    title: 'Costs and profit',
    text: 'Record what you spend — co-facilitators, software, the accountant — and InFlow adds a P&L, a monthly cash flow, the margin each venue, client and activity leaves you, and the income you need each month to break even.',
    feature: { key: 'costs', label: 'Costs, P&L and cash flow' },
  },
  {
    icon: Receipt,
    title: 'Tax, only if you want it',
    text: 'InFlow can suggest whether each payment is taxable, whether tax was withheld, the VAT treatment, and how much to set aside under Romanian rules for PFA or SRL. Every suggestion is labelled as one, and you decide.',
    feature: { key: 'tax', label: 'Tax suggestions' },
  },
  {
    icon: Database,
    title: 'Your data, your choice',
    text: 'Everything starts switched on; Settings → Features turns off whatever you don’t need, and explains each one. The demo practice lives apart from your own data — switch between them in Settings, or from the banner on top. Keep your records on this device, or connect Notion to have them anywhere.',
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
        <p className={styles.tourText}>{s.text}</p>
        {s.feature && (
          <label className={styles.tourCheck}>
            <input type="checkbox" checked={settings.features[s.feature.key]}
              onChange={(e) => updateSettings({ features: { [s.feature!.key]: e.target.checked } })} />
            {s.feature.label} (optional — on now)
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
