import { Compass, ArrowRight } from 'lucide-react'
import { Button } from '../components/Button'

// The intro screen shown to a genuine first-timer (and again after the databases are emptied for
// a fresh start). Generic, attribution-free language only — see CLAUDE.md.
export function LandingPage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-3">
        <Compass size={40} className="text-accent" aria-hidden />
        <h2 className="font-display text-2xl">Run your own Odyssey</h2>
        <p className="max-w-prose font-sans text-text-secondary">
          An Odyssey is six weeks spent installing <strong>one</strong> small behaviour by practising
          it daily — in the smallest honest version — witnessed by one other person. You don’t study
          change; you practise it into being.
        </p>
        <p className="max-w-prose font-sans text-text-secondary">
          Transformation isn’t an act of information or motivation. It’s the residue of what you do,
          quietly, on ordinary days. So this app holds the structure — the charter, the daily loop,
          the weekly look — and asks only that you keep showing up at low power. Forty-two
          unremarkable days change a person more than three perfect ones.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-lg">How it works</h3>
        <ol className="flex max-w-prose flex-col gap-3 font-sans text-sm text-text-primary">
          <Step n="1" title="Write the charter">
            Turn a wish into one tiny, anchored, un-missable daily action — small enough that you
            could do it on your worst day, in about two minutes.
          </Step>
          <Step n="2" title="Run the daily loop">
            Each day: do the tiny version, mark it, write one line. Under a minute. The loop does the
            remembering so you don’t have to.
          </Step>
          <Step n="3" title="Reflect weekly">
            Once a week, read how the week actually went and change exactly one thing. The daily loop
            keeps you moving; the weekly one keeps you aimed.
          </Step>
          <Step n="4" title="Harvest, then begin again">
            At day forty-two you name what installed and decide to keep, grow, or retire it — then
            point the same method at the next thing. Learn it once; run it for life.
          </Step>
        </ol>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-tertiary bg-background-secondary p-5">
        <h3 className="font-display text-lg">A few things to know</h3>
        <ul className="flex flex-col gap-2 font-sans text-sm text-text-secondary">
          <li>
            <strong className="font-medium text-text-primary">One behaviour at a time.</strong> Focus
            is the whole advantage — spend it on one thing and it compounds.
          </li>
          <li>
            <strong className="font-medium text-text-primary">A miss is never a failure.</strong> A
            lapse is data, met warmly. The only rule that matters is: don’t skip two days running.
          </li>
          <li>
            <strong className="font-medium text-text-primary">Never alone.</strong> One human buddy —
            just a name and an email here — who knows what you’re attempting. Being witnessed beats
            willpower; you arrange contact with them off-app.
          </li>
        </ul>
      </div>

      <p className="max-w-prose font-sans text-sm text-text-secondary">
        New to this? Keep the gentle background notes on (Settings → Guidance) for a quiet hand along
        the way. Once it’s second nature, switch them — and this page — off.
      </p>

      <div>
        <Button onClick={() => navigate('/charter')}>
          Start your first Odyssey
          <ArrowRight size={18} aria-hidden />
        </Button>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-md border border-tertiary bg-background-secondary p-4">
      <span className="font-mono text-sm font-medium text-accent">{n}</span>
      <span>
        <strong className="font-medium">{title}.</strong> {children}
      </span>
    </li>
  )
}
