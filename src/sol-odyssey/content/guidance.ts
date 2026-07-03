// Companion guidance — the gentle, optional background notes shown as twisties beside the
// practical fields (toggled by the `showGuidance` setting). Each note leans ~60% on *why we do
// this here*, ~20% on *what's behind it*, ~20% on *how it plays out over the long run*.
//
// Voice: warm, plain, second-person, unhurried. Generic public-domain behaviour-change language
// only — NEVER name any source of the method (people, books, programs, orgs). See CLAUDE.md.

export interface GuidanceEntry {
  /** Short label shown on the closed twisty. */
  summary: string
  /** The note revealed when opened. */
  body: string
}

export const GUIDANCE = {
  // ── Charter ──────────────────────────────────────────────────────────────────────────────
  theWish: {
    summary: 'Why just one behaviour?',
    body: "An Odyssey carries a single piece of cargo — one specific, observable action, not three habits or a whole new life. Focus is the entire advantage: spend it on one thing and it compounds; split it, and it scatters. Say the wish plainly for now, in your own voice — you'll shrink and sharpen it in the steps ahead.",
  },
  identity: {
    summary: 'Why frame it as identity?',
    body: "You're not just 'doing walks' — you're becoming someone who moves. We start here because behaviour follows identity more loyally than identity follows behaviour: each small action is a quiet vote for the kind of person you are. Across many Odysseys, it's this accumulated sense of 'I'm someone who…' that lasts, long after any single habit.",
  },
  outcomePicture: {
    summary: 'Why picture the benefit first?',
    body: 'Before naming any obstacle, picture the payoff vividly — what an ordinary day feels like once this is part of you. Holding the benefit clearly gives the behaviour something to pull toward, not just a rule to obey. It quietly turns a chore into a step toward something you actually want.',
  },
  tinyFloor: {
    summary: 'Why make it so small?',
    body: "The floor is set absurdly low on purpose: a version you could do on your worst day, in about two minutes. Week one isn't about progress, it's about arrival — and a behaviour you can't fail at is one that survives bad days. Showing up at low power, every day, compounds into far more than the occasional burst of effort; more is always welcome, but it's a bonus, never the bar.",
  },
  anchor: {
    summary: 'Why attach it to a routine?',
    body: 'Hooking the action onto something you already do without fail — after the first coffee, say — hands the remembering to a habit you already have. The existing routine becomes the cue, so you lean on structure instead of willpower or reminders. Anchors are why the loop keeps turning long after the first motivation has faded.',
  },
  ifThen: {
    summary: 'Why plan the obstacle now?',
    body: "You can usually predict the one thing that will get in the way. Deciding your response in advance — 'if it rains, I walk the hallway' — means a tired evening doesn't get to decide for you, because the choice is already made. Pre-deciding turns obstacles from derailments into forks you've already mapped.",
  },
  whyValue: {
    summary: 'Why write down the why?',
    body: "One honest sentence about why this matters, tied to something you value. Motivation comes and goes like weather, so on the days the system isn't quite enough, this is the line you read. Connecting a small behaviour to a real value is what keeps it meaningful across the long haul — and across the Odysseys still to come.",
  },
  pairing: {
    summary: 'Why pair it with something?',
    body: "Optionally tie the behaviour to something you genuinely enjoy — a podcast you only allow yourself on the walk, say. Pairing a new action with an existing pleasure lends it some of that pull, making the first move easier on low days. It's a small, entirely optional lever — but a well-chosen pairing can carry you through the weeks when willpower runs thin.",
  },
  dailySuccess: {
    summary: 'Why define what counts?',
    body: "Set the lowest bar that still counts, and make it binary: did it / didn't, no grey. A clear yes/no protects you from the slow creep of 'sort of' that quietly erodes a habit. When 'done' is unambiguous, the daily mark stays honest — and an honest record is the one that actually changes you.",
  },
  startDate: {
    summary: 'Why the start date matters',
    body: 'A start date you can point to — a Monday, the first of the month — gives the Odyssey a clean edge to begin from: easier to commit to, easier to remember. Fresh starts carry real motivational weight, and we lean on that on purpose. Pick one that feels like a genuine departure, not just the next blank day.',
  },
  shrinkTest: {
    summary: 'The shrink test',
    body: "A quick gut-check: would you bet you'll do this every single day for six weeks? If you hesitate even slightly, it's still too big — go back and shrink it. It's far better to start smaller than you think you need and let it grow on its own; an Odyssey that's too ambitious on day one rarely reaches day forty-two.",
  },

  // ── Today / daily loop ───────────────────────────────────────────────────────────────────
  stateCheckin: {
    summary: 'Why check in with yourself first?',
    body: "Before you act, it helps to actually know where you are. Naming a feeling in a word or two — and noticing it in your body for a breath — quietly loosens its grip; from there you get a real choice: how you'll relate to what's here, and what you'd rather feel instead, letting the doing follow that choice rather than the reverse. It's private, on this device only, and takes about thirty seconds. Over time, that small pause before acting is often the difference between reacting and choosing.",
  },
  selfMonitor: {
    summary: 'Why one line a day?',
    body: 'Marking the day and writing a single line is the smallest possible act of paying attention — and noticing your own behaviour is the highest-yield lever there is for changing it. It costs about ten seconds and turns a vague intention into something you can see. Over six weeks, those lines also become a quiet record of who you were becoming.',
  },
  sentToBuddy: {
    summary: 'Why tell your buddy?',
    body: 'Reaching out to one person who knows what you’re attempting turns a private resolution into a kept promise — being witnessed shifts behaviour more reliably than willpower alone. The reaching out *is* the accountability; the app sends nothing. A steady witness is the part most people skip, and the part that most often makes the difference.',
  },

  // ── Tracker ──────────────────────────────────────────────────────────────────────────────
  trackerLegend: {
    summary: 'Reading the grid',
    body: 'Filled = a done day. Open = a miss — no crosses, no guilt. Tap any day that has already happened to read, edit, or back-fill it (handy when you did the thing but forgot to log — it’s marked logged-late, kept honest). A small check on a cell marks a day you sent to your buddy. At a glance, the groove forms — and seeing it form is the whole point of the grid.',
  },
  flexibleStreak: {
    summary: 'About the streak',
    body: "We show your current and best streak, but the streak isn't the point — and a broken one isn't a failure. The real rule is gentler and sturdier: never skip two days running. One gap is an accident; it's the second in a row that quietly starts a new habit pointed the wrong way. Aim for that, and the numbers take care of themselves.",
  },
  selfCompassion: {
    summary: 'About a missed day',
    body: "A missed day is data, not a verdict. The useful question isn't 'did I fail?' but 'what got in the way, and what's the smallest step back?' — recovery is the metric that matters. Meeting a lapse warmly, instead of with guilt, is exactly what keeps you honest enough to return; over a lifetime of Odysseys, it's shame that ends them, not missed days.",
  },

  // ── Weekly reflection ────────────────────────────────────────────────────────────────────
  weeklyReflect: {
    summary: 'Why reflect weekly?',
    body: 'Once a week you read the week as it actually was — count the days first, without judging — then change exactly one thing. The daily loop keeps you moving; this weekly look keeps you aimed. Repeated over time, this small habit of steering becomes the skill of running any change deliberately.',
  },
  oneLever: {
    summary: 'Why only one change?',
    body: 'Choose exactly one adjustment for next week — a smaller floor, a new anchor, a different time — and resist the urge to overhaul everything. One lever at a time lets you actually learn what works, instead of changing five things and knowing nothing. Slow, single, deliberate turns are how the behaviour gets re-sized into something that fits your real life.',
  },
  temperature: {
    summary: 'What the temperature tracks',
    body: "The 1–10 reading isn't a grade — it's how *installed* the behaviour feels, how close to automatic. Watch the drift over the weeks rather than the number on any single day; the aim is the moment it stops needing you to decide. That shift toward automatic, week over week, is the real summit of an Odyssey.",
  },

  // ── Harvest ──────────────────────────────────────────────────────────────────────────────
  harvest: {
    summary: 'Why harvest?',
    body: "Day forty-two isn't an ending — it's a handover. Before deciding anything, name honestly what the behaviour feels like now: automatic, half-there, still effortful? Six weeks rarely 'finishes' a habit; it gives it roots. Naming what installed is how you close one Odyssey holding something real to carry into the next.",
  },
  keepGrowRetire: {
    summary: 'Keep · Grow · Retire',
    body: "Every Odyssey ends with a deliberate decision about the behaviour's future — and all three answers are wins, not grades. Keep it as quiet maintenance, grow it into something larger, or retire it because it served its purpose. Choosing on purpose, rather than letting it drift, is itself the practice; over time it's how a string of six-week efforts becomes a life you're steering.",
  },
  compounding: {
    summary: 'The compounding part',
    body: 'Each Odyssey installs a behaviour and, just as importantly, sharpens your skill at running Odysseys. By the third or fourth, the charter writes itself, the right size is obvious, and the buddy rhythm is second nature. The visible harvest is the habits; the quieter one is becoming someone who can change on purpose — for the rest of your life.',
  },
  // Outcome-specific — all three are valued equally, and differently.
  harvestKeep: {
    summary: 'On keeping it',
    body: "Keeping a behaviour means it earned a quiet, permanent place — held at its tiny floor as maintenance, no longer needing a whole Odyssey to stay alive. Maintenance isn't the lesser choice; it's the goal of most behaviours, the point where something simply *is* what you do. It also frees the slot, so your full attention is available for the next thing worth installing.",
  },
  harvestGrow: {
    summary: 'On growing it',
    body: "Growing a behaviour means this version did its job and you're ready for more — a larger floor, a fuller version, in the next cycle. You're not starting over; you're building on roots that already hold. Picking it up again, bigger, is how a two-minute walk becomes, over a few Odysseys, something you'd never have dared commit to on day one.",
  },
  harvestRetire: {
    summary: 'On retiring it',
    body: 'Retiring a behaviour is a clean, honest win — it served its purpose, taught you what it had to, and you let it go without guilt. Not everything is meant to be kept, and knowing when something has done its work is its own kind of wisdom. The space it frees is room for whatever matters more to you now.',
  },
  // ── Planning, commitment, reminders, companion (post-MVP) ──────────────────────────────────
  plannedOdyssey: {
    summary: 'Why plan ahead?',
    body: "Writing the charter is its own work — saving it as a draft lets you do it unhurried, sleep on it, and sharpen the tiny version before any clock starts. You can even line up your next Odyssey while the current one finishes, so there’s no gap between ending and beginning. A number isn’t reserved until you actually begin, so nothing is wasted if you change your mind — the draft simply waits, ready, until you’re sure.",
  },
  commitmentDevice: {
    summary: 'Why set a safety line?',
    body: "A pre-decided stake raises the cost of drifting before the temptation arrives — while you’re calm and honest. The app only ever witnesses it: it holds your own words and shows them back the moment a gap opens; the keeping stays with you and your buddy. Make it sting just enough to matter, never cruel — the point is a gentle guardrail for the wobble, not a punishment to dread.",
  },
  reminders: {
    summary: 'Why (and why not) reminders?',
    body: "A nudge at a fixed time hands the remembering to the system instead of your willpower — useful while the loop is still new. But they’re a scaffold, not a master: skipped once you’ve done the thing, and never sent to anyone but you. The daily message to your buddy is what truly carries the loop; let a notification prompt you, but don’t let it become the relationship.",
  },
  aiCompanion: {
    summary: 'What is the companion for?',
    body: "An optional, private witness for the in-between — it mirrors back what you wrote and, at most, asks one gentle question. It never advises, scores, or decides for you. It is not your buddy and never replaces one; think of it as something to reflect with between human check-ins, or while you’re still finding your person. A human witness remains the heart of the method.",
  },
} as const

export type GuidanceKey = keyof typeof GUIDANCE
