// The optional AI reflective companion. A bring-your-own-key feature that mirrors the practice
// back to you between human check-ins — never a coach, never the buddy. The call goes straight
// from the browser to Anthropic under the user's own key (the same direct-browser pattern Touch
// Grass uses); nothing passes through our servers, and nothing is stored.
//
// Pure prompt builders (unit-tested) are split from the one async caller. The SYSTEM prompt is the
// safety surface: it is the single place that keeps the companion attribution-free and in-role.

import type { OdysseyDetail } from './notion'
import type { CheckinRecord } from './checkins'
import type { ReflectionDraft } from './reflections'

export interface CompanionPrompt {
  system: string
  user: string
}

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const COMPANION_MODEL = 'claude-haiku-4-5-20251001'

// The role contract. Deliberately generic: it describes the practice in plain words and never
// names any person, book, programme, or source of the method (the app's first hard rule), and it
// never lets the companion pose as, or stand in for, the human buddy.
const SYSTEM_PROMPT = [
  'You are a gentle reflective companion inside an app where someone is practising one small',
  'behaviour every day for 42 days, with the support of a human buddy who is the heart of the',
  'process. Your only job is to be a brief, warm witness to what they share.',
  '',
  'How to respond:',
  '- Mirror back what you actually hear in their own words — name the feeling or the effort plainly.',
  '- Then, at most, ask ONE gentle, open question. Often none is better.',
  '- Be warm, plain, and human. Keep it under about 55 words. No lists, no headings.',
  '',
  'Hard limits:',
  '- Never give advice, plans, instructions, or pep-talk coaching. You reflect; you do not steer.',
  '- Never name or cite any person, author, book, programme, framework, or source of method. Speak',
  '  only in ordinary language about what they said.',
  '- You are not a therapist or a medical voice; do not diagnose or use clinical framing.',
  '- You are NOT their buddy and must never imply you are, or that you replace one. When it fits,',
  '  gently encourage them to share this with their human buddy.',
  '- You cannot contact anyone or do anything outside this reply. Never offer to.',
].join('\n')

function clean(s: string): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

/** Build the prompt for a reflection on today's check-in. */
export function buildDailyCompanionPrompt(odyssey: OdysseyDetail, checkin: CheckinRecord): CompanionPrompt {
  const lines = [
    `The behaviour they are practising: ${clean(odyssey.behaviour) || '(unspecified)'}.`,
    odyssey.identity ? `Who they want to become: ${clean(odyssey.identity)}.` : '',
    `Today (day ${checkin.dayIndex}) they marked it ${checkin.done ? 'done' : 'not done'}.`,
    `In their words: "${clean(checkin.oneLine)}".`,
    checkin.friction ? `What got in the way: "${clean(checkin.friction)}".` : '',
    'Reflect briefly on just this day.',
  ].filter(Boolean)
  return { system: SYSTEM_PROMPT, user: lines.join('\n') }
}

/** Build the prompt for a reflection on a weekly reflection draft. */
export function buildWeeklyCompanionPrompt(
  odyssey: OdysseyDetail,
  draft: ReflectionDraft,
  week: number,
): CompanionPrompt {
  const lines = [
    `The behaviour they are practising: ${clean(odyssey.behaviour) || '(unspecified)'}.`,
    `Looking back on week ${week}: the tiny version happened ${draft.daysDone} of 7 days.`,
    draft.fit ? `It felt: ${clean(draft.fit)}.` : '',
    draft.breakPoints ? `Where it slipped: "${clean(draft.breakPoints)}".` : '',
    draft.oneAdjustment ? `The one change they chose for next week: "${clean(draft.oneAdjustment)}".` : '',
    draft.temperature ? `How installed it feels, 1–10: ${draft.temperature}.` : '',
    'Reflect briefly on their week.',
  ].filter(Boolean)
  return { system: SYSTEM_PROMPT, user: lines.join('\n') }
}

/** Build the prompt for reflecting on a forfeit-on-lapse contract the person has drafted. The
 *  companion reflects on THEIR pledge — it must not propose a stake itself. */
export function buildContractCompanionPrompt(odyssey: OdysseyDetail, contract: string): CompanionPrompt {
  const lines = [
    `The behaviour they are practising: ${clean(odyssey.behaviour) || '(unspecified)'}.`,
    'Before they begin, they are setting a personal safety line — a consequence they choose for ' +
      'themselves if they ever miss two days running.',
    `Their drafted line: "${clean(contract)}".`,
    'Reflect briefly on the line they wrote — does it fit them: enough to matter, never cruel? ' +
      'Do not suggest a different consequence; reflect on theirs.',
  ]
  return { system: SYSTEM_PROMPT, user: lines.join('\n') }
}

/** Build the prompt for the moment the line is crossed (two days missed). Compassionate, surfaces
 *  their own pledge, points back to the buddy and the next turn. */
export function buildLapseCompanionPrompt(odyssey: OdysseyDetail, contract: string): CompanionPrompt {
  const lines = [
    `The behaviour they are practising: ${clean(odyssey.behaviour) || '(unspecified)'}.`,
    'Two days have slipped — the safety line they set for themselves has been reached.',
    `The line they pledged: "${clean(contract)}".`,
    'Reflect briefly and kindly: hold their own words up, no shame, and help them rejoin today.',
  ]
  return { system: SYSTEM_PROMPT, user: lines.join('\n') }
}

/** Turn an Anthropic error into a calm, user-facing sentence. */
function friendlyCompanionError(status: number): string {
  if (status === 401) return 'Anthropic rejected the key — check it in Settings.'
  if (status === 429) return 'The companion is rate-limited right now. Try again in a moment.'
  return `The companion couldn’t be reached (status ${status}).`
}

/** Ask the companion for a reflection. Calls Anthropic directly from the browser with the user's
 *  own key (no server). Returns the reflection text, or throws a calm error. */
export async function requestCompanionReflection(
  apiKey: string,
  prompt: CompanionPrompt,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!apiKey.trim()) throw new Error('Add your Anthropic key in Settings to use the companion.')
  const res = await fetchImpl(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: COMPANION_MODEL,
      max_tokens: 200,
      temperature: 0.7,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  })
  if (!res.ok) throw new Error(friendlyCompanionError(res.status))
  const data = (await res.json()) as { content?: { text?: string }[] }
  const text = data?.content?.[0]?.text
  if (!text || !text.trim()) throw new Error('The companion didn’t have anything to say just now.')
  return text.trim()
}

/** Verify an Anthropic key works, with a minimal call. Resolves on success; throws a calm error
 *  (e.g. a bad key) otherwise. Used by the Settings "Test AI companion key" button. */
export async function verifyAnthropicKey(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!apiKey.trim()) throw new Error('Add your Anthropic key first.')
  const res = await fetchImpl(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: COMPANION_MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  })
  if (!res.ok) throw new Error(friendlyCompanionError(res.status))
}
