// ─────────────────────────────────────────────────────────────────────────
// Loom's vocabulary layer. Every SCUMM-flavoured word on screen is an ALIAS —
// the base "loom" voice is the default (weaving, the Guild, the distaff), and a
// "plain" voice swaps each term for its common planner equivalent (task,
// Settings, backlog) for anyone who'd rather not learn the loom-house tongue.
//
// Nothing about behaviour changes with the voice — this is pure wording. Both
// maps carry the SAME keys, so a component only ever reads t('thread') and gets
// "thread" or "task" depending on the chosen voice. A handful of fully-flavoured
// sentences live here too (keys ending in a phrase), each with both voices, so
// the plain mode never leaks a half-translated loom idiom.
// ─────────────────────────────────────────────────────────────────────────

export const LEXICON_KEY = 'loom:lexicon'
export const DEFAULT_VOICE = 'loom' // SCUMM flavour is home base — the "vanilla" default.

// key → { loom, plain }. Capitalised keys are for headings/labels that appear
// title-cased; lower-case keys are for inline nouns/verbs.
const TERMS = {
  // ── Core nouns ──
  thread: { loom: 'thread', plain: 'task' },
  threads: { loom: 'threads', plain: 'tasks' },
  Thread: { loom: 'Thread', plain: 'Task' },
  Threads: { loom: 'Threads', plain: 'Tasks' },
  skein: { loom: 'skein', plain: 'project' },
  skeins: { loom: 'skeins', plain: 'projects' },
  Skein: { loom: 'Skein', plain: 'Project' },
  Skeins: { loom: 'Skeins', plain: 'Projects' },
  loose: { loom: 'Loose threads', plain: 'Ungrouped' },

  // ── Views ──
  skeinView: { loom: 'Skeins', plain: 'Projects' },
  weekView: { loom: 'The Warp', plain: 'Week' },
  tapestryView: { loom: 'Tapestry', plain: 'History' },
  Tapestry: { loom: 'The Tapestry', plain: 'History' },

  // ── The week furniture ──
  warp: { loom: 'the warp', plain: 'the week' },
  Warp: { loom: 'The warp', plain: 'The week' },
  warpLabel: { loom: 'Warp', plain: 'Week' },   // short nav label
  distaff: { loom: 'the distaff', plain: 'the backlog' },
  Distaff: { loom: 'The distaff', plain: 'Backlog' },
  distaffSub: {
    loom: 'unspun threads — pull one onto a day',
    plain: 'unscheduled tasks — pull one onto a day',
  },

  // ── Verbs ──
  spin: { loom: 'spin', plain: 'add' },
  Spin: { loom: 'Spin', plain: 'Add' },
  weave: { loom: 'weave', plain: 'complete' },
  Weave: { loom: 'Weave', plain: 'Complete' },
  woven: { loom: 'woven', plain: 'done' },
  Woven: { loom: 'Woven', plain: 'Done' },
  unravel: { loom: 'unravel', plain: 'delete' },
  Unravel: { loom: 'Unravel', plain: 'Delete' },
  reravel: { loom: 're-ravel', plain: 'undo' },

  // ── Settings / connection ──
  guild: { loom: 'the Guild', plain: 'Settings' },
  Guild: { loom: 'The Guild', plain: 'Settings' },
  guildVerb: { loom: 'Guild', plain: 'Settings' },
  settingsLive: {
    loom: '◆ Bound to Notion — reading and writing your real threads.',
    plain: '◆ Connected to Notion — reading and writing your real tasks.',
  },
  settingsDemo: {
    loom: '◇ Demo loom — sample threads kept only on this device.',
    plain: '◇ Demo — sample tasks kept only on this device.',
  },
  settingsIntroA: {
    loom: 'Loom keeps your warp locally by default. Bind it to your own Notion database and every thread is backed up there — the single source of truth. The',
    plain: 'Loom keeps your week on this device by default. Connect your own Notion database and every task is backed up there — the single source of truth. The',
  },
  settingsIntroB: {
    loom: 'walks the whole setup, including a database you can duplicate in one click.',
    plain: 'walks the whole setup, including a database you can duplicate in one click.',
  },
  weaveLive: { loom: 'Weave live', plain: 'Connect' },
  disconnectDemo: { loom: 'Disconnect — return to the demo loom', plain: 'Disconnect — return to the demo' },
  reachingLoom: { loom: 'Reaching the loom…', plain: 'Connecting…' },

  // ── Re-warp ritual (carry-over) ──
  rewarp: { loom: 'Re-warp the loom', plain: 'Carry over' },
  rewarpVerb: { loom: 'Re-warp', plain: 'Carry over' },
  rewarpLede: {
    loom: 'Threads still on the loom from past warps. Flick each one forward onto the new warp, or back to the distaff.',
    plain: 'Tasks left unfinished from past weeks. Flick each one forward onto the new week, or back to the backlog.',
  },
  rewarpEmpty: {
    loom: 'Nothing left hanging — the past threads are woven clean.',
    plain: 'Nothing left over — past weeks are all wrapped up.',
  },
  rewarpDone: {
    loom: 'The warp is re-warped. Weave on.',
    plain: 'Carried over. You\'re set for the week.',
  },

  // ── Drafts (recurring weaves) ──
  draft: { loom: 'draft', plain: 'template' },
  drafts: { loom: 'drafts', plain: 'templates' },
  Drafts: { loom: 'Drafts', plain: 'Templates' },
  draftsLede: {
    loom: 'A draft is a saved set of threads — a "Work warp", a "Long weekend". Weave one onto any warp in a single tap.',
    plain: 'A template is a saved set of tasks — a "Work week", a "Long weekend". Add one to any week in a single tap.',
  },
  castDraft: { loom: 'Weave onto this warp', plain: 'Add to this week' },
  saveDraft: { loom: 'Save this warp as a draft', plain: 'Save this week as a template' },
  repeatWeekly: { loom: 'Re-weave every warp', plain: 'Repeat every week' },

  // ── Rhythm (daily routine) ──
  rhythm: { loom: 'rhythm', plain: 'routine' },
  Rhythm: { loom: 'Rhythm', plain: 'Routine' },
  rhythms: { loom: 'rhythms', plain: 'routines' },
  Rhythms: { loom: 'Rhythms', plain: 'Routines' },
  rhythmLede: {
    loom: 'A rhythm is the pattern the loom already knows — threads it places on the warp before you sit down.',
    plain: 'A routine is your daily checklist — tasks placed on every day of the week automatically.',
  },
  castRhythm: { loom: 'Weave onto this warp', plain: 'Add to this week' },
  setAsRhythm: { loom: 'Set as rhythm', plain: 'Set as routine' },
  unsetRhythm: { loom: 'Unset rhythm', plain: 'Unset routine' },
  rhythmCast: {
    loom: 'Your rhythm was woven onto the warp.',
    plain: 'Your routine was added to the week.',
  },
  // Single rhythm
  rhythmBanner: {
    loom: 'Your rhythm is ready. Weave it onto this warp?',
    plain: 'Your routine is ready. Add it to this week?',
  },
  // Multiple rhythms
  rhythmsBanner: {
    loom: 'Your rhythms are ready. Weave them onto this warp?',
    plain: 'Your routines are ready. Add them to this week?',
  },
  rhythmSortLabel: { loom: 'Rhythm order', plain: 'Routine order' },
  resetBanners: { loom: 'Reset warp banners', plain: 'Reset week banners' },
  resetBannersHint: {
    loom: 'Brings back the rhythm and draft offers for the current warp if you dismissed them by accident.',
    plain: 'Brings back the routine and template offers for this week if you dismissed them by accident.',
  },

  // ── Search / trace ──
  // Short so it never truncates in the compact toolbar.
  searchPlaceholder: { loom: 'Trace…', plain: 'Search' },
  searchLabel: {
    loom: 'Trace threads and skeins',
    plain: 'Search tasks and projects',
  },
  unwovenOnly: { loom: 'Unwoven only', plain: 'Unfinished only' },
  rhythmSort: { loom: 'Rhythm order', plain: 'Routine order' },
  foldWoven: { loom: 'Fold woven', plain: 'Fold done' },
  onLoom: { loom: 'on the loom', plain: 'open' },

  // ── Empty / status sentences ──
  emptyLoom: {
    loom: 'The loom stands bare. Spin a thread above to begin.',
    plain: 'Nothing here yet. Add a task above to begin.',
  },
  loadingLoom: { loom: 'Warping the loom…', plain: 'Loading…' },
  spinLoose: { loom: 'Spin a loose thread…', plain: 'Add a task…' },
  addThread: { loom: 'thread', plain: 'task' },
  addUnspun: { loom: 'unspun thread', plain: 'backlog task' },

  // ── The Tapestry ──
  pastDebt: { loom: 'unwoven from past warps', plain: 'unfinished from past weeks' },
  // Renamed from "The cloth you've woven" — poetic but didn't say what the grid
  // actually shows; the hint line underneath now spells out the color encoding.
  clothWoven: { loom: 'The days you\'ve woven', plain: 'Days completed' },
  clothWovenHint: {
    loom: 'Each cell is a day — the deeper the dye, the more you wove that day; a dot marks anything still on the loom.',
    plain: 'Each cell is a day — the darker it is, the more you completed that day; a dot marks anything still open.',
  },
  tapestryEmpty: {
    loom: 'No woven cloth yet — this fills in as you weave your warps.',
    plain: 'Nothing here yet — this fills in as you finish tasks.',
  },
  stillOpen: { loom: 'still open', plain: 'still open' },
}

// Build the flat term map for a voice — { key: string }.
export function pickLexicon(voice) {
  const v = voice === 'plain' ? 'plain' : 'loom'
  const out = {}
  for (const [key, pair] of Object.entries(TERMS)) out[key] = pair[v]
  return out
}

export function loadVoice() {
  try {
    const v = localStorage.getItem(LEXICON_KEY)
    if (v === 'loom' || v === 'plain') return v
  } catch { /* private mode */ }
  return DEFAULT_VOICE
}

export function saveVoice(voice) {
  try { localStorage.setItem(LEXICON_KEY, voice === 'plain' ? 'plain' : 'loom') } catch { /* quota */ }
}

export { TERMS }
