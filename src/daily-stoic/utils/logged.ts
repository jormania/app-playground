import { ReflectionRecord } from '../services/NotionService';

/**
 * Did this day get *practised*, as opposed to merely touched?
 *
 * Every write path creates the same Notion page, so a page's existence proves
 * nothing on its own — favouriting the day's maxim creates one too, and a
 * bookmark is not a journal entry. A day counts when it holds something the
 * user wrote or chose: a reflection, an Amor Fati obstacle or challenge type,
 * a mood, or (in the full journal) morning intentions, passions, or a virtue.
 *
 * `favorite` is deliberately absent. This predicate is the single definition
 * of a logged day — streaks, the week dots, Stats' day count, the cycle
 * retrospectives, the digest and the evening nudge all read it, so they can
 * never disagree about what today was.
 */
export function hasContent(r: ReflectionRecord | undefined | null): boolean {
  if (!r) return false;
  return Boolean(
    (r.text || '').trim() ||
    (r.fateInput || '').trim() ||
    (r.mood || '').trim() ||
    (r.morningIntentions || '').trim() ||
    (r.virtue || '').trim() ||
    (r.acceptanceTags || []).length > 0 ||
    (r.passions || []).length > 0
  );
}
