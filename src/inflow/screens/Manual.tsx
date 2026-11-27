/**
 * The manual: everything a freelancer starting out needs to know about InFlow, on one page, in
 * plain words. Opened from the book in the header (#/manual). Sections are short, with a picture
 * where a picture explains faster, tips in green, notes in blue and things to watch in amber.
 */
import type { ReactNode } from 'react'
import { AlertTriangle, BookOpen, CalendarClock, Coins, Database, Info, Landmark, Lightbulb, MapPin, PieChart, Receipt, Settings as Cog, Sparkles } from 'lucide-react'
import { BackBar } from '../components/BackBar'
import styles from '../styles/ui.module.css'

const SECTIONS: { id: string; title: string; icon: ReactNode }[] = [
  { id: 'start', title: 'Start here', icon: <Sparkles size={16} aria-hidden /> },
  { id: 'money', title: 'Three kinds of money', icon: <Coins size={16} aria-hidden /> },
  { id: 'daily', title: 'Every day', icon: <CalendarClock size={16} aria-hidden /> },
  { id: 'features', title: 'Switch on what you need', icon: <Cog size={16} aria-hidden /> },
  { id: 'costs', title: 'Costs and profit', icon: <Receipt size={16} aria-hidden /> },
  { id: 'tax', title: 'Tax', icon: <Landmark size={16} aria-hidden /> },
  { id: 'venues', title: 'Venues and deals', icon: <MapPin size={16} aria-hidden /> },
  { id: 'reports', title: 'Reports', icon: <PieChart size={16} aria-hidden /> },
  { id: 'data', title: 'Your data', icon: <Database size={16} aria-hidden /> },
  { id: 'words', title: 'Words used', icon: <BookOpen size={16} aria-hidden /> },
]

function Tip({ children }: { children: ReactNode }) {
  return <div className={`${styles.manualNote} ${styles.manualTip}`}><Lightbulb size={16} aria-hidden /><div><b>Tip.</b> {children}</div></div>
}
function Note({ children }: { children: ReactNode }) {
  return <div className={`${styles.manualNote} ${styles.manualInfo}`}><Info size={16} aria-hidden /><div>{children}</div></div>
}
function Careful({ children }: { children: ReactNode }) {
  return <div className={`${styles.manualNote} ${styles.manualWarn}`}><AlertTriangle size={16} aria-hidden /><div><b>Watch out.</b> {children}</div></div>
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section id={`manual-${id}`} className={`${styles.panel} ${styles.manualSection}`} aria-labelledby={`manual-${id}-h`}>
      <h2 id={`manual-${id}-h`} className={styles.manualTitle}><span className={styles.manualIcon}>{icon}</span>{title}</h2>
      {children}
    </section>
  )
}

/** Where the money goes: what a client pays splits into the three things InFlow keeps apart. Drawn at phone width. */
function MoneyPicture() {
  const rows: [string, string, string, string][] = [
    ['Service income', 'your fee for the work', '→ your account', 'svgBoxAccent'],
    ['Cost recovery', 'money back for a cost', '→ your account', 'svgBoxAmber'],
    ['Tax withheld', 'kept by the client', '→ paid to the state', 'svgBoxBlue'],
  ]
  return (
    <svg viewBox="0 0 340 250" className={styles.manualSvg} role="img"
      aria-label="A client pays you. Your fee for the work is service income and reaches your account. Money back for a cost you paid is cost recovery and also reaches your account. Tax the client withheld goes to the state, already paid for you.">
      <rect x="95" y="4" width="150" height="46" rx="12" className={styles.svgBoxMuted} />
      <text x="170" y="25" textAnchor="middle" className={styles.svgText}>A client</text>
      <text x="170" y="42" textAnchor="middle" className={styles.svgSmall}>pays you</text>
      <path d="M170 50 V 62 H 14 V 226" className={styles.svgArrow} />
      {rows.map(([title, sub, where, cls], k) => {
        const y = 70 + k * 60
        const on = cls === 'svgBoxAccent'
        return (
          <g key={title}>
            <path d={`M14 ${y + 26} H 26`} className={styles.svgArrow} />
            <rect x="26" y={y} width="310" height="52" rx="12" className={styles[cls]} />
            <text x="40" y={y + 22} className={on ? styles.svgTextOn : styles.svgText}>{title}</text>
            <text x="40" y={y + 40} className={on ? styles.svgSmallOn : styles.svgSmall}>{sub}</text>
            <text x="324" y={y + 31} textAnchor="end" className={on ? styles.svgSmallOn : styles.svgSmall}>{where}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** An expected payment becoming received, in full or in part. Drawn at phone width. */
function ExpectedPicture() {
  return (
    <svg viewBox="0 0 340 214" className={styles.manualSvg} role="img"
      aria-label="An expected payment of 1,000 lei. If all of it arrives, it becomes received, 1,000 lei. If only 600 lei arrives, 600 becomes received and 400 stays expected.">
      <rect x="90" y="4" width="160" height="48" rx="12" className={styles.svgBoxDashed} />
      <text x="170" y="25" textAnchor="middle" className={styles.svgText}>Expected</text>
      <text x="170" y="42" textAnchor="middle" className={styles.svgSmall}>1,000 lei promised</text>
      <path d="M170 52 V 66 H 85 V 92" className={styles.svgArrow} />
      <path d="M170 66 H 255 V 92" className={styles.svgArrow} />
      <text x="85" y="84" textAnchor="end" dx="-8" className={styles.svgSmall}>all of it</text>
      <text x="255" y="84" dx="8" className={styles.svgSmall}>part</text>
      <rect x="6" y="92" width="158" height="48" rx="12" className={styles.svgBoxAccent} />
      <text x="85" y="113" textAnchor="middle" className={styles.svgTextOn}>Received</text>
      <text x="85" y="130" textAnchor="middle" className={styles.svgSmallOn}>1,000 lei</text>
      <rect x="176" y="92" width="158" height="48" rx="12" className={styles.svgBoxAccent} />
      <text x="255" y="113" textAnchor="middle" className={styles.svgTextOn}>Received</text>
      <text x="255" y="130" textAnchor="middle" className={styles.svgSmallOn}>600 lei</text>
      <rect x="176" y="150" width="158" height="48" rx="12" className={styles.svgBoxDashed} />
      <text x="255" y="171" textAnchor="middle" className={styles.svgText}>Still expected</text>
      <text x="255" y="188" textAnchor="middle" className={styles.svgSmall}>400 lei</text>
    </svg>
  )
}

/** Profit and cash flow answer different questions. */
function ProfitCashPicture() {
  return (
    <div className={styles.manualCompare}>
      <div className={styles.manualCompareCol}>
        <b>Profit (P&amp;L)</b>
        <span className={styles.manualQuestion}>“Is my work paying?”</span>
        <ul>
          <li>Income for your work</li>
          <li>− costs of the work (room, materials)</li>
          <li>− running costs (software, phone)</li>
          <li>= what the work leaves you</li>
        </ul>
      </div>
      <div className={styles.manualCompareCol}>
        <b>Cash flow</b>
        <span className={styles.manualQuestion}>“Where did the money go?”</span>
        <ul>
          <li>Everything that came in</li>
          <li>− everything that went out</li>
          <li>incl. a laptop, loan payments, what you took for yourself</li>
          <li>= what is in the bank</li>
        </ul>
      </div>
    </div>
  )
}

const FEATURE_TABLE: [string, string, string][] = [
  ['Expected payments', 'You invoice and wait to be paid', 'Money promised but not in yet; overdue flags; one tap to mark it received'],
  ['Costs, P&L and cash flow', 'You spend money on the work', 'What you keep after costs; where the money went'],
  ['Tax suggestions', 'You want to know what to set aside', 'Taxable or not, tax withheld, VAT, a reserve to put aside'],
  ['Venue deals', 'You rent rooms or share takings', 'What each room really leaves you per session'],
  ['Foreign currencies', 'Clients pay in euro or dollars', 'Converted to lei at the day’s rate'],
  ['Refunds', 'You sometimes pay a client back', 'A refund against the payment it came from'],
  ['Insights', 'On from the start', 'Pain points and wins, in plain words'],
  ['Printable reports', 'On from the start', 'A report to save as PDF, for you or your accountant'],
]

export function Manual() {
  const jump = (id: string) => document.getElementById(`manual-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <>
      <BackBar />
      <header className={styles.manualHero}>
        <span className={styles.manualHeroIcon}><BookOpen size={22} aria-hidden /></span>
        <div>
          <h1 className={styles.manualHeroTitle}>The InFlow manual</h1>
          <p className={styles.manualLede}>Everything you need to know to keep track of your freelance money, in ten short parts. Read it once from the top, or jump to what you need.</p>
        </div>
      </header>

      <nav className={styles.manualToc} aria-label="Contents">
        {SECTIONS.map((s, i) => (
          <button key={s.id} type="button" className={styles.manualTocItem} onClick={() => jump(s.id)}>
            <span className={styles.manualTocNum}>{i + 1}</span>{s.title}
          </button>
        ))}
      </nav>

      <Section {...SECTIONS[0]}>
        <p>InFlow keeps track of <b>the money your work brings in</b>: who paid, for what, when, and what is left for you. It is for freelancers in Romania: coaches, trainers, facilitators, consultants, anyone paid per session, project or package.</p>
        <ol className={styles.manualSteps}>
          <li><b>Look around the demo.</b> InFlow opens on an invented practice so you can see every screen filled in. Your own data is kept apart.</li>
          <li><b>Switch to your data</b> in Settings → Your data. Choose this device, or your Notion if you use it.</li>
          <li><b>Add your first payment</b> with the green <i>Add income</i> button: the amount, who paid and when. That’s all it needs.</li>
          <li><b>Switch on what you need</b> (part 4) when you need it, not before.</li>
        </ol>
        <Tip>Add payments the day they arrive. Two minutes now saves an evening at the end of the year.</Tip>
        <Note>InFlow is not accounting software and not tax advice. It helps you see your money clearly; your accountant files your taxes.</Note>
      </Section>

      <Section {...SECTIONS[1]}>
        <p>Not everything a client sends you is the same kind of money. InFlow keeps three things apart, so your figures never mix them up:</p>
        <MoneyPicture />
        <dl className={styles.manualDefs}>
          <div className={styles.manualDefAccent}><dt>Service income</dt><dd>What you charged for your work. This is your <b>income</b> everywhere in InFlow: the Overview, reports, tax.</dd></div>
          <div className={styles.manualDefAmber}><dt>Cost recovery</dt><dd>A client paying you back for something you paid for them (a room, train tickets). Mark the payment’s activity as <i>Reimbursement</i>. It is not income: it only balances a cost.</dd></div>
          <div className={styles.manualDefBlue}><dt>Tax withheld</dt><dd>Some clients (often companies) keep part of your fee and pay it to the tax office for you. Enter the full fee and the tax withheld: InFlow counts the tax as already paid, not as money you received.</dd></div>
        </dl>
        <Tip>If a client pays 1,000 lei and keeps 100 lei as tax, enter 1,000 lei with 100 lei withheld. Your account shows 900 lei arrived; your income is still 1,000.</Tip>
      </Section>

      <Section {...SECTIONS[2]}>
        <h3 className={styles.manualSub}>Adding a payment</h3>
        <p>Amount, client and date come first; everything else on the form is optional. A known client fills in the rest from their last payment. Fields like <i>Sessions</i> and <i>Hours</i> make the reports smarter (what a session or an hour leaves you) but you can skip them.</p>
        <h3 className={styles.manualSub}>Money you are waiting for</h3>
        <p>With <i>Expected payments</i> on, record an invoice as <b>expected</b>. When the money arrives, tap <i>Received</i>. If only part arrives, tap <i>Part…</i>: the part becomes received and the rest stays expected.</p>
        <ExpectedPicture />
        <h3 className={styles.manualSub}>Paying a client back</h3>
        <p>With <i>Refunds</i> on, open the payment and choose <i>Refund</i>. The refund counts in the month the money went back. The original payment never changes.</p>
        <Careful>Don’t edit or delete a payment to “undo” money you gave back. Record a refund instead, so last month’s figures stay right.</Careful>
      </Section>

      <Section {...SECTIONS[3]}>
        <p>InFlow starts simple: income, insights and printable reports. Everything else is a switch in <b>Settings → Features</b>, or in the welcome guide. Turn one on when it matches your work:</p>
        <div className={styles.manualTableWrap}>
          <table className={styles.manualTable}>
            <thead><tr><th>Feature</th><th>Turn it on when…</th><th>What you get</th></tr></thead>
            <tbody>{FEATURE_TABLE.map(([f, when, what]) => <tr key={f}><th scope="row">{f}</th><td>{when}</td><td>{what}</td></tr>)}</tbody>
          </table>
        </div>
        <Note>Turning a feature off hides it; it never deletes what you recorded. Turn it back on and everything is there.</Note>
      </Section>

      <Section {...SECTIONS[4]}>
        <p>With <i>Costs</i> on, record what you spend: the room you hired, materials, software, your phone, the accountant. Each cost has a <b>kind</b>, and the kind decides where it counts:</p>
        <ul className={styles.manualList}>
          <li><b>Costs of the work</b>: you only pay them because a session happened (the room, materials, a co-facilitator).</li>
          <li><b>Running costs</b>: you pay them anyway (software, phone, insurance, rent).</li>
          <li><b>Equipment, loans, money you take for yourself</b>: they move cash but aren’t a cost of the work, so they show in Cash flow, not in profit.</li>
        </ul>
        <ProfitCashPicture />
        <Tip>Mark a cost as <i>deductible</i> when you can claim it against tax (PFA in the real system, SRL). If unsure, ask your accountant once and keep the answer in the cost’s notes.</Tip>
      </Section>

      <Section {...SECTIONS[5]}>
        <p>With <i>Tax suggestions</i> on, InFlow estimates the tax on your income from the published Romanian rules for your situation (Settings → Tax profile: PFA in the real system, PFA on a norm, micro-SRL).</p>
        <ul className={styles.manualList}>
          <li>Each payment gets a <b>suggested</b> treatment (taxable or not, VAT) that you confirm or change.</li>
          <li>A <b>reserve</b> is suggested for each taxable payment: money to put aside so the tax bill is no surprise.</li>
          <li>The <b>Tax</b> report shows the year so far, what is still to set aside, and the deadlines.</li>
        </ul>
        <Careful>These are estimates to plan with, not tax advice. Rules change every year; your accountant has the final word.</Careful>
        <Tip>Move the suggested reserve to a separate account the day a payment arrives. It’s the simplest way never to spend your tax.</Tip>
      </Section>

      <Section {...SECTIONS[6]}>
        <p>A <b>venue</b> is where the work happens: a room, a studio, a client’s office, or online. With <i>Venue deals</i> on, tell InFlow how each room is paid and it works out what each session really leaves you.</p>
        <dl className={styles.manualDefs}>
          <div className={styles.manualDefAccent}><dt>Fixed fee</dt><dd>You pay the same per session, however many people come. Good when sessions are full.</dd></div>
          <div className={styles.manualDefAmber}><dt>Revenue share</dt><dd>The venue takes a percentage of what each session brings in. Safer when you’re not sure who will come.</dd></div>
          <div className={styles.manualDefBlue}><dt>No cost</dt><dd>Online, the client’s office, or an agency pays for the room.</dd></div>
        </dl>
        <h3 className={styles.manualSub}>When a venue’s price changes</h3>
        <p>Edit the venue (Settings → Clients, sources &amp; venues) and set the new deal. InFlow asks <i>from when</i> it applies: payments from that date move to the new price; earlier ones keep the old one. Reports → Venue deals then shows each price with its dates.</p>
        <Note>Venue deals <b>estimates</b> from the deal you set. When you actually pay the venue (an invoice, a month’s rent), record it with <i>+ Add a cost</i>: it then counts in Profit and Cash flow, and nothing is counted twice.</Note>
      </Section>

      <Section {...SECTIONS[7]}>
        <p>The period buttons at the top (Week, Month, Year…) set what every screen shows.</p>
        <div className={styles.manualCards}>
          {[
            ['Overview', 'How this period is going: what came in, against your target and the period before.'],
            ['Review', 'The story of the period: what moved, who carries your income, pain points and wins.'],
            ['Clients & work', 'Which clients and kinds of work leave you the most, per session and per hour.'],
            ['Venue deals', 'What each room leaves you, and what a different deal would have left.'],
            ['Profit', 'Profit and cash flow, month by month.'],
            ['Tax', 'The year’s estimate, what to set aside, the deadlines.'],
            ['Print', 'Build a report and save it as PDF for yourself or your accountant.'],
          ].map(([t, d]) => <div key={t} className={styles.manualCard}><b>{t}</b><span>{d}</span></div>)}
        </div>
        <Tip>Tap any bar in a chart to see its figures. In the Review, tap a client, venue or kind of work to see those payments.</Tip>
      </Section>

      <Section {...SECTIONS[8]}>
        <ul className={styles.manualList}>
          <li><b>This device:</b> your data stays in this browser, on this phone or computer. Nothing is sent anywhere.</li>
          <li><b>Notion:</b> your data lives in your own Notion databases, on every device you use.</li>
          <li><b>Backup:</b> Settings → Backup &amp; export downloads everything as one file. A restore can be undone.</li>
          <li><b>The demo</b> is kept apart from your data. Clear it or bring it back in Settings.</li>
        </ul>
        <Careful>On <i>This device</i>, clearing the browser’s data deletes your records. Download a backup once a month; InFlow reminds you.</Careful>
      </Section>

      <Section {...SECTIONS[9]}>
        <dl className={styles.manualGlossary}>
          {[
            ['Income', 'What you charged for your work (service income). Not money back for costs, not tax withheld.'],
            ['Cost recovery', 'Money a client paid you back for a cost. Balances the cost; not income.'],
            ['Expected', 'Money promised but not in yet. Counted nowhere until received.'],
            ['Withheld tax', 'Tax a client paid to the state for you, out of your fee.'],
            ['Reserve', 'Money to put aside for tax, suggested for each taxable payment.'],
            ['Deductible', 'A cost you can claim against tax (in the real system or as an SRL).'],
            ['P&L', 'Profit and loss: income less the costs of earning it.'],
            ['Cash flow', 'All money in and out, including equipment and what you take for yourself.'],
            ['Session', 'One sitting of the work. A 4-session package is 4.'],
            ['Venue deal', 'How a room is paid: a fixed fee, a share of takings, or nothing.'],
          ].map(([w, d]) => <div key={w}><dt>{w}</dt><dd>{d}</dd></div>)}
        </dl>
        <p className={styles.hint}>Most fields also have a short hint under them; Settings → Appearance &amp; guide turns those hints on or off, and replays the welcome guide.</p>
      </Section>
    </>
  )
}
