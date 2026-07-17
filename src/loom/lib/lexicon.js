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
  weekView: { loom: 'The Week', plain: 'Week' },
  tapestryView: { loom: 'Tapestry', plain: 'History' },
  Tapestry: { loom: 'The Tapestry', plain: 'History' },

  // ── The week furniture ──
  warp: { loom: 'the warp', plain: 'the week' },
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

  // ── Re-warp ritual (carry-over) ──
  rewarp: { loom: 'Re-warp the week', plain: 'Carry over' },
  rewarpVerb: { loom: 'Re-warp', plain: 'Carry over' },
  rewarpLede: {
    loom: 'Threads still on the loom from past weeks. Flick each one forward onto the new week, or back to the distaff.',
    plain: 'Tasks left unfinished from past weeks. Flick each one forward onto the new week, or back to the backlog.',
  },
  rewarpEmpty: {
    loom: 'Nothing left hanging — the old weeks are woven clean.',
    plain: 'Nothing left over — past weeks are all wrapped up.',
  },
  rewarpDone: {
    loom: 'The week is re-warped. Weave on.',
    plain: 'Carried over. You’re set for the week.',
  },

  // ── Drafts (recurring weaves) ──
  draft: { loom: 'draft', plain: 'template' },
  drafts: { loom: 'drafts', plain: 'templates' },
  Drafts: { loom: 'Drafts', plain: 'Templates' },
  draftsLede: {
    loom: 'A draft is a saved set of threads — a “Work week”, a “Long weekend”. Weave one onto any week in a single tap.',
    plain: 'A template is a saved set of tasks — a “Work week”, a “Long weekend”. Add one to any week in a single tap.',
  },
  castDraft: { loom: 'Weave onto this week', plain: 'Add to this week' },
  saveDraft: { loom: 'Save this week as a draft', plain: 'Save this week as a template' },
  repeatWeekly: { loom: 'Re-weave every week', plain: 'Repeat every week' },

  // ── Search / focus ──
  searchPlaceholder: {
    loom: 'Search threads and skeins…',
    plain: 'Search tasks and projects…',
  },
  unwovenOnly: { loom: 'Unwoven only', plain: 'Unfinished only' },
  topOnly: { loom: 'Top of each group', plain: 'Top of each group' },
  foldWoven: { loom: 'Fold woven', plain: 'Fold done' },
  onLoom: { loom: 'on the loom', plain: 'open' },

  // ── Empty / status sentences ──
  emptyLoom: {
    loom: 'The loom stands bare. Spin a thread above to begin.',
    plain: 'Nothing here yet. Add a task above to begin.',
  },
  loadingLoom: { loom: 'Warping the loom…', plain: 'Loading…' },
  spinLoose: { loom: 'Spin a loose thread…', plain: 'Add a task…' },
  addThread: { loom: '＋ thread', plain: '＋ task' },
  addUnspun: { loom: '＋ unspun thread', plain: '＋ backlog task' },
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
