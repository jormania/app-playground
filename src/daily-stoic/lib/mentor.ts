// The Socratic mentor — Enhance 1's driver of practice.
//
// Unlike a reflective witness that mirrors your words back, the mentor is meant
// to move you: it reads what you actually wrote and what you actually did (via
// the Commitments ledger, lib/commitments.ts), finds the gap between the two,
// and ends every reply with a demand. It is bring-your-own-key: the call goes
// straight from the browser to Anthropic under the user's own key (the same
// direct-browser pattern Sol Odyssey and Touch Grass use) — nothing passes
// through our servers, nothing is stored, each reply is ephemeral.
//
// The pure prompt builders below are unit-tested; the one async caller is not.
// SYSTEM_PROMPT is the whole persona and safety surface — the single place that
// keeps the mentor Socratic, grounded, and never cruel.

export interface MentorPrompt {
  system: string;
  user: string;
}

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
// A real Socratic driver needs range and judgement, so this defaults higher than
// a mere witness would. It is the user's own key, called at most a few times a day.
const MENTOR_MODEL = 'claude-sonnet-5';

export const MENTOR_KEY_STORAGE = 'daily-stoic:anthropic-key';
export const MENTOR_ENABLED_STORAGE = 'daily-stoic:mentor-enabled';

// The persona. Daily Stoic openly teaches from the Stoic canon, so — unlike Sol
// Odyssey — the mentor may name the ancient Stoics and their ideas. What it must
// never do is reproduce copyrighted text from any modern book, invent citations,
// shame the user, or merely echo them.
const SYSTEM_PROMPT = [
  'You are the Mentor: a Socratic teacher of Stoic practice, in the lineage of Epictetus, Seneca,',
  'and Marcus Aurelius, read through the modern art of applying them to daily life. Someone is',
  'building a real Stoic practice inside this app — meditating on mortality, foreseeing the day’s',
  'friction, sorting what is and is not up to them, making concrete promises each morning and',
  'reckoning them each night. You are their driver, not their witness. Your purpose is to move them',
  'to action, not to comfort them.',
  '',
  'Method — Socratic, always:',
  '- Lead with the one question they cannot dodge: the gap between what they say they value and what',
  '  they actually did, planned, or avoided. Expose the evasion or the untested assumption.',
  '- Do NOT summarise or validate their words back to them. They already know what they wrote. Find',
  '  the tension in it.',
  '- End every reply with ONE demand: a single concrete action to commit to now, or one pointed',
  '  question they must answer before they move on. Never end soft, never trail off into reassurance.',
  '',
  'Grounding — reason from the practice, not from platitudes:',
  '- The dichotomy of control: press them to spend effort only on what is theirs (their judgement,',
  '  choice, effort) and to release the rest.',
  '- The disciplines of desire, action, and assent: wanting rightly, acting well toward others, and',
  '  testing impressions before believing them.',
  '- Negative visualisation and foreseen adversity as preparation, and the obstacle itself as the',
  '  training ground — what blocks the way can become the way.',
  '- You may name the ancient Stoics and their ideas plainly. Never quote any book or modern author',
  '  verbatim, and never invent a citation or attribute words to someone.',
  '',
  'Bearing:',
  '- Firm, warm, exact. Never shame, mock, diagnose, or moralise. Assume they are capable and acting',
  '  in good faith; hold them to it.',
  '- Plain prose, no lists, no headings, no markdown, no emoji. About 90 words at most.',
  '- You live inside this single reply. You cannot remember other conversations, act in the world, or',
  '  follow up. Do not pretend otherwise or offer to.',
  '- If they signal real crisis or intent to harm themselves, drop the method entirely and tell them',
  '  plainly to reach a trusted person or a crisis line now.',
].join('\n');

function clean(s: string | undefined | null): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max = 600): string {
  const c = clean(s);
  return c.length > max ? `${c.slice(0, max)}…` : c;
}

export interface MentorWorry {
  text: string;
  category: 'up-to-me' | 'not-up-to-me' | 'unassigned';
}

export interface MentorDebt {
  text: string;
  ageDays: number;
}

export interface MorningContext {
  cycle: number;
  week: number;
  virtue: string;
  premeditatio: string;
  worries: MentorWorry[];
  openDebts: MentorDebt[];
  keptRate: number;
  reckonedCount: number;
}

const CATEGORY_LABEL: Record<MentorWorry['category'], string> = {
  'up-to-me': 'up to them',
  'not-up-to-me': 'not up to them',
  unassigned: 'unsorted',
};

/** The morning challenge: read the foreseen friction and the debts still owed,
 *  then demand one concrete promise for today. */
export function buildMorningChallengePrompt(ctx: MorningContext): MentorPrompt {
  const lines: string[] = [
    `It is the morning of week ${ctx.week} of cycle ${ctx.cycle}. This week’s virtue in focus: ${clean(ctx.virtue) || 'unspecified'}.`,
  ];

  if (ctx.premeditatio) {
    lines.push(`What they foresee facing today (their own words): "${truncate(ctx.premeditatio)}".`);
  } else {
    lines.push('They have not written what they foresee facing today.');
  }

  if (ctx.worries.length) {
    const w = ctx.worries
      .map((x) => `"${clean(x.text)}" (${CATEGORY_LABEL[x.category]})`)
      .join('; ');
    lines.push(`Concerns they logged: ${w}.`);
  }

  if (ctx.openDebts.length) {
    const d = ctx.openDebts
      .map((x) => `"${clean(x.text)}" (unkept, ${x.ageDays} day${x.ageDays === 1 ? '' : 's'} old)`)
      .join('; ');
    lines.push(`Promises they made earlier and have not yet reckoned: ${d}.`);
  }

  if (ctx.reckonedCount > 0) {
    lines.push(`Across reckoned promises so far they have kept ${ctx.keptRate}%.`);
  }

  lines.push(
    'Challenge them Socratically on what they are avoiding, then demand ONE specific, provable ' +
      'promise they will keep before tonight — small enough to be certain, real enough to cost ' +
      'something.',
  );

  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

export interface EveningReckoning {
  text: string;
  status: 'kept' | 'broken';
  note?: string;
}

export interface EveningContext {
  cycle: number;
  week: number;
  virtue: string;
  reckonings: EveningReckoning[];
  stillOpen: MentorDebt[];
  reflection: string;
  mood: string;
  passions: string[];
  reframes: string[];
}

/** The evening reckoning: collect on the day's promises, hold their own words
 *  up, and demand the next move. */
export function buildEveningReckoningPrompt(ctx: EveningContext): MentorPrompt {
  const lines: string[] = [
    `It is evening, week ${ctx.week} of cycle ${ctx.cycle}. This week’s virtue in focus: ${clean(ctx.virtue) || 'unspecified'}.`,
  ];

  const kept = ctx.reckonings.filter((r) => r.status === 'kept');
  const broken = ctx.reckonings.filter((r) => r.status === 'broken');

  if (kept.length) {
    lines.push(`Promises they kept today: ${kept.map((r) => `"${clean(r.text)}"`).join('; ')}.`);
  }
  if (broken.length) {
    lines.push(
      `Promises they broke today: ${broken
        .map((r) => `"${clean(r.text)}"${r.note ? ` — their reason: "${clean(r.note)}"` : ''}`)
        .join('; ')}.`,
    );
  }
  if (ctx.stillOpen.length) {
    lines.push(
      `Promises they left unreckoned — neither kept nor broken: ${ctx.stillOpen
        .map((x) => `"${clean(x.text)}"`)
        .join('; ')}.`,
    );
  }
  if (!ctx.reckonings.length && !ctx.stillOpen.length) {
    lines.push('They made no promise to keep today.');
  }

  if (ctx.mood) lines.push(`They rate their mood: ${clean(ctx.mood)}.`);
  if (ctx.passions.length) {
    lines.push(`Passions they admit ruled them today: ${ctx.passions.map(clean).join(', ')}.`);
  }
  if (ctx.reframes.length) {
    lines.push(`Externals they say they accepted: ${ctx.reframes.map((r) => `"${clean(r)}"`).join('; ')}.`);
  }
  if (ctx.reflection) {
    lines.push(`Their evening self-audit (own words): "${truncate(ctx.reflection, 800)}".`);
  }

  lines.push(
    'Reckon with them Socratically. If they broke a promise, do not accept the excuse at face value — ' +
      'ask the question that exposes it, without shaming them. If they kept it, do not merely praise — ' +
      'press for the harder version tomorrow. End by demanding either their single promise for ' +
      'tomorrow or the one question they must sit with tonight.',
  );

  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

export interface PatternPassion {
  label: string;
  count: number;
}

export interface PatternContext {
  span: string;
  virtue?: string;
  topPassions: PatternPassion[];
  keptRate: number;
  reckonedCount: number;
  recentBroken: string[];
}

/** The dashboard intervention: name the recurring pattern in their own data and
 *  demand they act on it, rather than just observe it. */
export function buildPatternInterventionPrompt(ctx: PatternContext): MentorPrompt {
  const lines: string[] = [`Looking across ${clean(ctx.span) || 'their recent practice'}.`];

  if (ctx.topPassions.length) {
    const p = ctx.topPassions
      .map((x) => `${clean(x.label)} (${x.count} time${x.count === 1 ? '' : 's'})`)
      .join(', ');
    lines.push(`The passions they most often admit to: ${p}.`);
  }
  if (ctx.reckonedCount > 0) {
    lines.push(`They have kept ${ctx.keptRate}% of the promises they reckoned in this span.`);
  }
  if (ctx.recentBroken.length) {
    lines.push(`Recently broken promises: ${ctx.recentBroken.map((r) => `"${clean(r)}"`).join('; ')}.`);
  }
  if (ctx.virtue) lines.push(`This week’s virtue in focus: ${clean(ctx.virtue)}.`);

  lines.push(
    'Name the one pattern that matters most here — not all of them — and turn it into a single, ' +
      'concrete discipline they can practise this week. End with the demand.',
  );

  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

export interface CouncilContext {
  cycle: number;
  week: number;
  virtue: string;
  discipline: string;
  disciplineGloss: string;
  focusQuestion: string;
  daysLogged: number;
  daysInSpan: number;
  keptRate: number;
  reckonedCount: number;
  brokenPromises: string[];
  topPassions: PatternPassion[];
  dominantMood: string;
}

/** The weekly Council (Enhance 2): the mentor convenes the week's own evidence
 *  and confronts the practitioner with it, adapting to their demonstrated
 *  weakness, then charges them for the week ahead. */
export function buildCouncilPrompt(ctx: CouncilContext): MentorPrompt {
  const lines: string[] = [
    `A weekly Council review. Week ${ctx.week} of cycle ${ctx.cycle} is closing. This week trained the virtue of ${clean(ctx.virtue)} through the discipline of ${clean(ctx.discipline)} — ${clean(ctx.disciplineGloss)}.`,
    `They journaled ${ctx.daysLogged} of ${ctx.daysInSpan} days.`,
  ];
  if (ctx.reckonedCount > 0) {
    lines.push(`They kept ${ctx.keptRate}% of the promises they reckoned this span.`);
  }
  if (ctx.brokenPromises.length) {
    lines.push(`Promises they broke: ${ctx.brokenPromises.map((p) => `"${clean(p)}"`).join('; ')}.`);
  }
  if (ctx.topPassions.length) {
    lines.push(
      `The passions they most admit to: ${ctx.topPassions
        .map((p) => `${clean(p.label)} (${p.count})`)
        .join(', ')}.`,
    );
  }
  if (ctx.dominantMood) lines.push(`Their prevailing mood: ${clean(ctx.dominantMood)}.`);
  lines.push(`This week's focus question was: "${clean(ctx.focusQuestion)}".`);
  lines.push(
    'Hold a brief council with them: name the single most important truth this week\'s data tells — ' +
      'especially where their practice and their intentions diverge — without shaming them. Then charge ' +
      'them with one concrete discipline for the coming week, tied to the virtue and discipline named above.',
  );
  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

export interface CharacterArcContext {
  span: string;
  cyclesCompleted: number;
  daysPracticed: number;
  keptRate: number;
  reckonedCount: number;
  recurringPassions: PatternPassion[];
  strongestVirtue?: string;
}

/** The character-arc synthesis (Enhance 3): a longitudinal read of who the
 *  practitioner is becoming across the whole record — the through-line and the
 *  one enduring work still ahead. */
export function buildCharacterArcPrompt(ctx: CharacterArcContext): MentorPrompt {
  const lines: string[] = [
    `A longitudinal character review across ${clean(ctx.span) || 'their whole practice'}.`,
    `They have practised ${ctx.daysPracticed} days across ${ctx.cyclesCompleted} completed cycle${ctx.cyclesCompleted === 1 ? '' : 's'}.`,
  ];
  if (ctx.reckonedCount > 0) {
    lines.push(`Over that time they kept ${ctx.keptRate}% of their reckoned promises.`);
  }
  if (ctx.recurringPassions.length) {
    lines.push(
      `The passions that recur most across the whole span: ${ctx.recurringPassions
        .map((p) => `${clean(p.label)} (${p.count})`)
        .join(', ')}.`,
    );
  }
  if (ctx.strongestVirtue) lines.push(`The virtue they most often claim to have practised: ${clean(ctx.strongestVirtue)}.`);
  lines.push(
    'Speak to the arc, not the day: name the through-line of who they are becoming, the real progress ' +
      'the record shows, and the one enduring work still ahead of them. End by naming that work as a ' +
      'question they must keep answering.',
  );
  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

/** Turn an Anthropic error into a calm, user-facing sentence. */
function friendlyMentorError(status: number): string {
  if (status === 401) return 'Anthropic rejected the key — check it in Settings.';
  if (status === 429) return 'The mentor is rate-limited right now. Try again in a moment.';
  if (status >= 500) return 'Anthropic is having trouble right now. Try again shortly.';
  return `The mentor couldn’t be reached (status ${status}).`;
}

/** Ask the mentor. Calls Anthropic directly from the browser with the user's own
 *  key (no server). Returns the reply text, or throws a calm error. */
export async function requestMentor(
  apiKey: string,
  prompt: MentorPrompt,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!apiKey.trim()) throw new Error('Add your Anthropic key in Settings to wake the mentor.');
  const res = await fetchImpl(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MENTOR_MODEL,
      max_tokens: 320,
      temperature: 0.6,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  });
  if (!res.ok) throw new Error(friendlyMentorError(res.status));
  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data?.content?.[0]?.text;
  if (!text || !text.trim()) throw new Error('The mentor had nothing to say just now.');
  return text.trim();
}

/** Verify an Anthropic key works, with a minimal call. Resolves on success;
 *  throws a calm error otherwise. Used by the Settings "Test key" button. */
export async function verifyAnthropicKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!apiKey.trim()) throw new Error('Add your Anthropic key first.');
  const res = await fetchImpl(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MENTOR_MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  if (!res.ok) throw new Error(friendlyMentorError(res.status));
}
