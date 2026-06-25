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
  shrinkTest: {
    summary: 'The shrink test',
    body: "A quick gut-check: would you bet you'll do this every single day for six weeks? If you hesitate even slightly, it's still too big — go back and shrink it. It's far better to start smaller than you think you need and let it grow on its own; an Odyssey that's too ambitious on day one rarely reaches day forty-two.",
  },

  // ── Today / daily loop ───────────────────────────────────────────────────────────────────
  selfMonitor: {
    summary: 'Why one line a day?',
    body: 'Marking the day and writing a single line is the smallest possible act of paying attention — and noticing your own behaviour is the highest-yield lever there is for changing it. It costs about ten seconds and turns a vague intention into something you can see. Over six weeks, those lines also become a quiet record of who you were becoming.',
  },
  sentToBuddy: {
    summary: 'Why tell your buddy?',
    body: 'Reaching out to one person who knows what you’re attempting turns a private resolution into a kept promise — being witnessed shifts behaviour more reliably than willpower alone. The reaching out *is* the accountability; the app sends nothing. A steady witness is the part most people skip, and the part that most often makes the difference.',
  },

  // ── Tracker ──────────────────────────────────────────────────────────────────────────────
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
} as const

export type GuidanceKey = keyof typeof GUIDANCE
