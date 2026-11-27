/**
 * The manual: what a coach starting out on their own needs to know about InFlow, on one page, in
 * plain words. Opened from the book in the header (#/manual) or Settings. Every example is a
 * coaching practice: 1:1, group, workshops, retreats, companies and individuals. Short parts,
 * a picture where a picture explains faster; tips green, notes blue, things to watch amber.
 * It states what the screens do: change a screen named here, check the line here too.
 */
import type { ReactNode } from 'react'
import { AlertTriangle, BookOpen, CalendarClock, Coins, Database, Info, Landmark, Lightbulb, List, MapPin, Package, PieChart, Printer, Receipt, Settings as Cog, Sparkles, Users } from 'lucide-react'
import { BackBar } from '../components/BackBar'
import styles from '../styles/ui.module.css'

const SECTIONS: { id: string; title: string; icon: ReactNode }[] = [
  { id: 'start', title: 'Start here', icon: <Sparkles size={16} aria-hidden /> },
  { id: 'practice', title: 'Set up your practice', icon: <Users size={16} aria-hidden /> },
  { id: 'money', title: 'Three kinds of money', icon: <Coins size={16} aria-hidden /> },
  { id: 'core', title: 'Always on: income, insights, print', icon: <List size={16} aria-hidden /> },
  { id: 'packages', title: 'Sessions, packages, retainers', icon: <Package size={16} aria-hidden /> },
  { id: 'routine', title: 'A simple routine', icon: <CalendarClock size={16} aria-hidden /> },
  { id: 'features', title: 'Switch on what you need', icon: <Cog size={16} aria-hidden /> },
  { id: 'venues', title: 'Rooms and venues', icon: <MapPin size={16} aria-hidden /> },
  { id: 'costs', title: 'Costs and profit', icon: <Receipt size={16} aria-hidden /> },
  { id: 'tax', title: 'Tax', icon: <Landmark size={16} aria-hidden /> },
  { id: 'reports', title: 'What the reports tell you', icon: <PieChart size={16} aria-hidden /> },
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

/** A two-column table that stacks on a phone. */
function Table({ head, rows }: { head: [string, string, string]; rows: [string, string, string][] }) {
  return (
    <div className={styles.manualTableWrap}>
      <table className={styles.manualTable}>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(([a, b, c]) => <tr key={a}><th scope="row">{a}</th><td data-label={head[1]}>{b}</td><td data-label={head[2]}>{c}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

/** Where the money goes: what a client pays splits into the three things InFlow keeps apart. Drawn at phone width. */
function MoneyPicture() {
  const rows: [string, string, string, string][] = [
    ['Service income', 'your coaching fee', '→ your account', 'svgBoxAccent'],
    ['Cost recovery', 'e.g. the retreat venue', '→ your account', 'svgBoxAmber'],
    ['Tax withheld', 'kept by a company', '→ paid to the state', 'svgBoxBlue'],
  ]
  return (
    <svg viewBox="0 0 340 250" className={styles.manualSvg} role="img"
      aria-label="A client pays you. Your coaching fee is service income and reaches your account. Money back for a cost you paid, such as the retreat venue, is cost recovery and also reaches your account. Tax a company client withheld goes to the state, already paid for you.">
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
      aria-label="A company owes 1,000 lei for a team coaching day. If all of it arrives, it becomes received, 1,000 lei. If only 600 lei arrives, 600 becomes received and 400 stays expected.">
      <rect x="90" y="4" width="160" height="48" rx="12" className={styles.svgBoxDashed} />
      <text x="170" y="25" textAnchor="middle" className={styles.svgText}>Expected</text>
      <text x="170" y="42" textAnchor="middle" className={styles.svgSmall}>team coaching · 1,000 lei</text>
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
          <li>− costs of the work (the group room, workbooks)</li>
          <li>− running costs (Zoom, supervision)</li>
          <li>= what the work leaves you</li>
        </ul>
      </div>
      <div className={styles.manualCompareCol}>
        <b>Cash flow</b>
        <span className={styles.manualQuestion}>“Where did the money go?”</span>
        <ul>
          <li>Everything that came in</li>
          <li>− everything that went out</li>
          <li>incl. a laptop for online sessions, a coaching certification, what you took for yourself</li>
          <li>= what is in the bank</li>
        </ul>
      </div>
    </div>
  )
}

const FEATURES: [string, string, string][] = [
  ['Expected payments', 'You invoice companies, sell packages in instalments or have retainers', 'Money owed but not in yet; overdue flags; Received in one tap'],
  ['Venue deals', 'You rent a room for group sessions, share takings with a studio, or run retreats', 'What each room leaves you per session; when a group breaks even'],
  ['Costs, P&L and cash flow', 'You pay for rooms, retreat venues, supervision or software', 'What you keep after costs; where the money went'],
  ['Tax suggestions', 'You want to know what to set aside', 'Taxable or not, tax withheld, VAT, a reserve per payment'],
  ['Foreign currencies', 'Clients abroad pay for online coaching in euro or pounds', 'Converted to lei at the day’s rate'],
  ['Refunds', 'A client stops a package early and you pay back what’s unused', 'A refund against the payment it came from'],
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
          <p className={styles.manualLede}>For coaches running their own practice: what InFlow does, how to set it up for the way you work, and what to look at each week. Read it once, then come back to the part you need.</p>
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
        <p>InFlow tracks <b>what your coaching earns</b>: who paid, for which kind of work, where, and what is left after costs and tax. It is not accounting software and not tax advice: it shows you your practice clearly, and your accountant files the taxes.</p>
        <ol className={styles.manualSteps}>
          <li><b>Look around the demo.</b> It is an invented coaching practice, so every screen is filled in. Your data is kept apart.</li>
          <li><b>Switch to your data</b> in Settings → Your data: this device, or your Notion.</li>
          <li><b>Set up your practice</b> (part 2): your clients, how they find you, where you coach.</li>
          <li><b>Get to know the Income tab, insights and printable reports</b> (part 4): they are on from the start.</li>
          <li><b>Add a payment</b> with <i>Add income</i>: amount, client, date. Everything else is optional.</li>
        </ol>
      </Section>

      <Section {...SECTIONS[1]}>
        <p>Four lists describe your practice. Set them up once (Settings → Clients, sources &amp; venues, or with <i>+ New</i> straight from a payment); every report is built from them.</p>
        <Table head={['In InFlow', 'In your practice', 'Why it matters']} rows={[
          ['Clients', 'Ioana (an individual), Nordbank (a company)', 'A client’s kind and country decide the VAT suggestion'],
          ['Sources', 'Referrals, your website, a coaching platform, an agency', 'Shows which channel brings the paying clients; a source can be set to withhold tax'],
          ['Activity', '1:1 coaching, group coaching, workshop, retreat, speaking', 'Compares what each kind of work leaves you per session and per hour'],
          ['Venues', 'Online, the room you rent for groups, a retreat centre, a company’s office', 'Shows what each room costs you, and when a group session breaks even'],
        ]} />
        <Tip>Set each client’s kind (individual or company) and country once, and InFlow suggests the VAT treatment for their payments. If a company always withholds tax, set the source it comes through to <i>Withheld at source</i>, and its payments arrive with the tax suggested.</Tip>
      </Section>

      <Section {...SECTIONS[2]}>
        <p>Not everything a client sends is income. InFlow keeps three things apart, so your figures never mix them:</p>
        <MoneyPicture />
        <dl className={styles.manualDefs}>
          <div className={styles.manualDefAccent}><dt>Service income</dt><dd>Your coaching fee. This is <b>income</b> everywhere in InFlow.</dd></div>
          <div className={styles.manualDefAmber}><dt>Cost recovery</dt><dd>A client paying you back for a cost: the venue of their team retreat, your train to their offsite. Choose the activity <i>Reimbursement</i>. Not income.</dd></div>
          <div className={styles.manualDefBlue}><dt>Tax withheld</dt><dd>Part of your fee a company keeps and pays to the tax office for you. Enter the full fee and the amount withheld.</dd></div>
        </dl>
        <Tip>Nordbank pays 1,000 lei for an executive coaching session and keeps 100 lei as tax: enter 1,000 lei with 100 lei withheld. 900 lei arrive; your income is 1,000.</Tip>
      </Section>

      <Section {...SECTIONS[3]}>
        <p>Three things are on from the start, and are all most coaches need in their first months.</p>

        <h3 className={styles.manualSub}><List size={15} aria-hidden /> Income</h3>
        <p>The Income tab lists every payment, newest first, grouped by month with each month’s total.</p>
        <ul className={styles.manualList}>
          <li><b>Search</b> by client, venue or note, and <b>filter</b> by client, source, venue, activity or status.</li>
          <li><b>Where it came from</b> splits the period by source, client, venue or activity; tap a part to see only those payments.</li>
          <li>Tap a payment to change it. <b>Copy</b> starts the next one from it: Ioana’s weekly session, same fee, dated today.</li>
          <li><b>CSV</b> exports what is shown, for a spreadsheet or your accountant.</li>
        </ul>

        <h3 className={styles.manualSub}><Lightbulb size={15} aria-hidden /> Insights</h3>
        <p>InFlow reads your payments and says, in plain words, what is worth a look. Only what applies to you shows: the best three on the Overview under <i>Worth a look</i>, all of them in Reports → Review → <i>Pain points</i>. For a coach, typically:</p>
        <ul className={styles.manualList}>
          <li>a regular client who has gone quiet, or one who is booking more;</li>
          <li>individual clients who came for one session and never returned;</li>
          <li>your quietest month, so you can plan for it next year;</li>
          <li>a large share of income from one client, often a single company contract;</li>
          <li>with Venue deals on, a room that lost money, or the same work paying better in another room;</li>
          <li>with Expected payments on, money that is overdue.</li>
        </ul>
        <p>👍 keeps an insight on top; 👎 hides it, or every insight like it. Settings → Features brings hidden ones back.</p>

        <h3 className={styles.manualSub}><Printer size={15} aria-hidden /> Printable reports</h3>
        <p>Reports → Print has four ready reports. Each follows the period chosen at the top; <i>Print / save as PDF</i> makes a file, <i>HTML</i> keeps a copy, and <i>Adjust</i> changes the title or sections.</p>
        <Table head={['Report', 'Print it', 'It holds']} rows={[
          ['Month at a glance', 'At the end of each month', 'What came in, what moved, who paid most'],
          ['Year in review', 'Once a year, before planning the next', 'The year’s shape, your best and weakest work, clients and rooms'],
          ['Client statement', 'When a client asks what they’ve paid, e.g. a company’s HR for its coaching budget', 'That client’s payments and total, nothing about anyone else'],
          ['For my accountant', 'Before filing, or when they ask', 'Income by source, profit, tax summary, every payment and cost'],
        ]} />
      </Section>

      <Section {...SECTIONS[4]}>
        <p>Coaching is sold in many shapes. Record each the way the money actually moves:</p>
        <Table head={['You sell', 'Record it as', 'So that']} rows={[
          ['A single session', 'One payment, Sessions 1', 'Each session is one line'],
          ['A 6-session package, paid upfront', 'One payment, Sessions 6', 'Per-session figures divide it by 6'],
          ['A package paid in 3 instalments', 'Three expected payments, each marked Received when it arrives', 'You always see what is still owed'],
          ['A monthly retainer', 'One payment a month, marked Recurring', 'Next month’s is suggested as expected'],
          ['A group programme', 'One payment per participant, or one with People per session', 'Venue deals can show when the group covers the room'],
          ['A company’s team coaching day', 'One expected payment for the invoice', 'Overdue invoices are flagged'],
        ]} />
        <ExpectedPicture />
        <p>When only part of an invoice arrives, tap <i>Part…</i>: the part is received, the rest stays expected. When a client stops a package early, record a <b>refund</b> for the unused sessions; the original payment stays as it was.</p>
        <Note>A free or reduced first session counts too: InFlow lists individual clients who came once, so you can follow up and offer a package.</Note>
        <Careful>Never edit or delete a payment to undo money you paid back. Record a refund, so past months stay right.</Careful>
      </Section>

      <Section {...SECTIONS[5]}>
        <ul className={styles.manualList}>
          <li><b>After each session:</b> add the payment, or tap <i>Received</i> on the one you expected.</li>
          <li><b>Once a week:</b> open the Overview. Check what is overdue and what is expected this month.</li>
          <li><b>Once a month:</b> read the Review (what grew, what slipped), put the suggested tax reserve aside, and download a backup if your data is on this device.</li>
        </ul>
        <Tip>Set a monthly income target in Settings → Target and flags: the Overview then shows how far along the month is.</Tip>
      </Section>

      <Section {...SECTIONS[6]}>
        <p>Income, insights and printable reports are always there (part 4). Turn the rest on in <b>Settings → Features</b> when your practice needs it:</p>
        <Table head={['Feature', 'Turn it on when', 'What you get']} rows={FEATURES} />
        <Note>Turning a feature off only hides it. What you recorded stays, and comes back when you turn it on.</Note>
      </Section>

      <Section {...SECTIONS[7]}>
        <p>With <i>Venue deals</i> on, tell InFlow how each place is paid, and it works out what every session there leaves you:</p>
        <dl className={styles.manualDefs}>
          <div className={styles.manualDefAccent}><dt>Fixed fee</dt><dd>The same price whoever comes: 200 lei an evening for the group room. Pays off when groups are full.</dd></div>
          <div className={styles.manualDefAmber}><dt>Revenue share</dt><dd>The venue keeps a percentage: a studio taking 30% of your workshop tickets. Safer while groups are small.</dd></div>
          <div className={styles.manualDefBlue}><dt>No cost</dt><dd>Online sessions, a company’s own office, or a programme where the organiser pays the room.</dd></div>
        </dl>
        <p>Enter <i>People per session</i> on group payments and Venue deals shows how many people a session needs to cover the room, and what a different deal would have left you.</p>
        <p><b>When a price changes</b> (the group room goes from 150 to 200 lei on 1 July): edit the venue and set the new deal <i>from</i> 1 July. Earlier sessions keep the old price.</p>
        <Note>Venue deals estimates from the deal. When you pay the venue (the retreat centre’s invoice, a month’s rent), record it with <i>+ Add a cost</i> so it counts in Profit and Cash flow. Nothing is counted twice.</Note>
      </Section>

      <Section {...SECTIONS[8]}>
        <p>With <i>Costs</i> on, record what you spend. Its <b>kind</b> decides where it counts:</p>
        <ul className={styles.manualList}>
          <li><b>Costs of the work</b>, paid because a session happened: the group room, a retreat venue, workbooks, a co-coach.</li>
          <li><b>Running costs</b>, paid anyway: video calls and booking apps, supervision, insurance, your coaching association.</li>
          <li><b>Equipment, a certification, money you take for yourself</b>: they move cash, so they show in Cash flow, not in profit.</li>
        </ul>
        <ProfitCashPicture />
        <Tip>Mark a cost <i>deductible</i> when it can be claimed against tax (PFA in the real system, SRL). Unsure? Ask your accountant once, and note the answer on the cost.</Tip>
      </Section>

      <Section {...SECTIONS[9]}>
        <p>With <i>Tax suggestions</i> on, InFlow estimates your tax from the published Romanian rules for your set-up (Settings → Tax profile: PFA in the real system, PFA on a norm, micro-SRL).</p>
        <ul className={styles.manualList}>
          <li>Each payment gets a <b>suggested</b> treatment (taxable, withheld, VAT) to confirm or change.</li>
          <li>Each taxable payment gets a <b>reserve</b>: the money to put aside for its tax.</li>
          <li>The <b>Tax</b> report shows the year so far and what is still to set aside.</li>
        </ul>
        <Tip>Move the reserve to a separate account the day the money arrives: the tax bill is then never a surprise.</Tip>
        <Careful>These are estimates to plan with, not tax advice. Rules change every year; your accountant has the last word.</Careful>
      </Section>

      <Section {...SECTIONS[10]}>
        <p>The period buttons at the top (Week, Month, Year…) set what every screen covers. Each report answers one question:</p>
        <div className={styles.manualCards}>
          {[
            ['Overview', 'How is this month going, and what is owed to me?'],
            ['Review', 'What grew, what slipped, and who carries my income?'],
            ['Clients & work', 'Which clients and which kind of coaching leave me most, per session and per hour?'],
            ['Venue deals', 'Is this room worth it, and would another deal suit me better?'],
            ['Profit', 'What do I keep after costs, month by month?'],
            ['Tax', 'How much should I have set aside by now?'],
            ['Print', 'A report as PDF, for me, a client or my accountant (part 4).'],
          ].map(([t, d]) => <div key={t} className={styles.manualCard}><b>{t}</b><span>{d}</span></div>)}
        </div>
        <Note>Watch how much of your income comes from one client: the Review flags it. A practice resting on one company contract is fragile.</Note>
      </Section>

      <Section {...SECTIONS[11]}>
        <ul className={styles.manualList}>
          <li><b>This device:</b> your data stays in this browser. Nothing is sent anywhere.</li>
          <li><b>Notion:</b> your data lives in your own Notion, on every device you use.</li>
          <li><b>Backup:</b> Settings → Backup &amp; export saves everything as one file. A restore can be undone.</li>
        </ul>
        <Careful>On <i>This device</i>, clearing the browser’s data deletes your records. Download a backup every month; InFlow reminds you.</Careful>
      </Section>

      <Section {...SECTIONS[12]}>
        <dl className={styles.manualGlossary}>
          {[
            ['Income', 'Your coaching fees. Not money back for costs, not tax withheld.'],
            ['Cost recovery', 'A client paying you back for a cost, like a retreat venue.'],
            ['Expected', 'Money owed but not in yet. Counted nowhere until received.'],
            ['Tax withheld', 'Tax a company paid to the state for you, out of your fee.'],
            ['Reserve', 'Money to put aside for the tax on a payment.'],
            ['Session', 'One coaching session. A 6-session package is 6.'],
            ['Recurring', 'A payment that repeats, like a monthly retainer.'],
            ['Venue deal', 'How a room is paid: a fixed fee, a share of takings, or nothing.'],
            ['Deductible', 'A cost you can claim against tax.'],
            ['P&L', 'Profit and loss: income less the costs of earning it.'],
            ['Cash flow', 'All money in and out, equipment and your own drawings included.'],
          ].map(([w, d]) => <div key={w}><dt>{w}</dt><dd>{d}</dd></div>)}
        </dl>
        <p className={styles.hint}>Most fields have a short hint under them; Settings → Appearance &amp; guide turns hints on or off and replays the welcome guide.</p>
      </Section>
    </>
  )
}
