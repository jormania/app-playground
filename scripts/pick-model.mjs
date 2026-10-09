// Which model tonight's daily-refactor run gets.
//
// `refactor` and `modernise` items — behaviour-preserving work that only merges
// once the workflow re-runs all three gates on a clean clone — run on Sonnet;
// `qol`, `visual` and discovery runs stay on Opus. The workflow has to decide
// before the agent starts, because `--model` is fixed at launch, so it needs
// its own reading of "the topmost eligible item". That reading is here, beside
// the backlog counter in build-meta.js, so it can be tested rather than trusted.
//
// Eligible is the skill's four conditions and nothing else: in the main list
// (not under `## Proposed`), state `open`, not claimed by an open PR, and not
// marked "not agent-executable". Class is not a condition for eligibility —
// only for the model.
//
// Every uncertain path falls back to Opus. Getting this wrong in that
// direction costs tokens; getting it wrong the other way puts a `visual` item
// in front of a cheaper model, which is the thing this exists to avoid.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OPUS = 'claude-opus-5-5';
export const SONNET = 'claude-sonnet-5-5';

// The classes whose PRs merge themselves behind the gates: what you see doesn't
// change, so a wrong move is caught by tests rather than by taste. Moved
// `refactor` here on 2026-10-09 to spare the weekly subscription limit.
const SONNET_CLASSES = new Set(['refactor', 'modernise']);

const CLASSES = new Set(['refactor', 'modernise', 'qol', 'visual', 'idea']);

/**
 * Read one backlog header into { id, cls, state }, or null if it isn't one.
 *
 * Found by the class-then-state pair (`· \`modernise\` · \`open\``) rather than
 * by splitting on `·` and counting, so a middle dot in a title can't shift
 * which segment is read as the state.
 */
export function parseHeader(line) {
  if (!line.startsWith('## ')) return null;
  const pair = /·\s*`([a-z]+)`\s*·\s*`([^`]+)`/g;
  for (const m of line.matchAll(pair)) {
    if (!CLASSES.has(m[1])) continue;
    const id = line.slice(3).split(' — ')[0].trim();
    return { id, cls: m[1], state: m[2].trim() };
  }
  return null;
}

/**
 * The item the agent will take tonight, by the skill's own rule, or null.
 *
 * @param {string} md       REFACTOR_BACKLOG.md
 * @param {Set<string>} claimed  ids named on a `Backlog-Item:` line of an open PR
 */
export function topmostEligible(md, claimed = new Set()) {
  for (const line of md.split('\n')) {
    if (/^##\s+Proposed\b/.test(line)) return null;
    const h = parseHeader(line);
    if (!h) continue;
    if (!/^open\b/.test(h.state)) continue;
    if (/not agent-executable/i.test(line)) continue;
    if (claimed.has(h.id)) continue;
    return h;
  }
  return null;
}

/**
 * The model for a run, and a one-line note for the agent's prompt.
 *
 * A discovery run (every other Friday — the workflow decides, by date) reads
 * the codebase for what's missing whatever sits on top. That is judgement, not
 * a gated change, so it stays on Opus.
 */
export function chooseModel(item, discovery) {
  if (discovery || !item || !SONNET_CLASSES.has(item.cls)) {
    return { model: OPUS, note: '' };
  }
  return {
    model: SONNET,
    note:
      `This run is on a lighter model because today's item, ${item.id}, is ` +
      `\`${item.cls}\`. Work that item only. If you have to mark it ` +
      '`dropped` or `blocked`, record that in the backlog and stop there — do ' +
      'not go on to the next item, which may be `qol` or `visual`.',
  };
}

// CLI: prints `model=`, `item=`, `class=` and `note=` lines for $GITHUB_OUTPUT.
// Never exits non-zero and never prints a partial set: any failure is Opus.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let out;
  try {
    // Anything but an explicit `false` counts as discovery — Opus.
    const i = process.argv.indexOf('--discovery');
    const discovery = !(i > -1 && process.argv[i + 1] === 'false');
    const claimed = new Set((process.env.CLAIMED || '').split(',').map((s) => s.trim()).filter(Boolean));
    const item = topmostEligible(readFileSync('REFACTOR_BACKLOG.md', 'utf8'), claimed);
    const { model, note } = chooseModel(item, discovery);
    out = { model, item: item?.id ?? '', cls: item?.cls ?? '', note };
  } catch (e) {
    out = { model: OPUS, item: '', cls: '', note: '' };
    console.error(`pick-model: ${e.message} — falling back to ${OPUS}`);
  }
  console.error(`pick-model: ${out.item || '(no eligible item)'} ${out.cls} -> ${out.model}`);
  process.stdout.write(`model=${out.model}\nitem=${out.item}\nclass=${out.cls}\nnote=${out.note}\n`);
}
