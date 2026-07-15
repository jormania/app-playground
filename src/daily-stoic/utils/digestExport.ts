import { ReflectionRecord } from '../services/NotionService';
import { getQuoteForDay } from './date';
import { DigestEntry, DayDigestEntry, parseReflectionQA } from './digest';
import { Worry } from './retrospective';
import { Commitment } from '../lib/commitments';

const COMMITMENT_STATUS_LABELS: Record<Commitment['status'], string> = {
  open: 'unreckoned',
  kept: 'kept',
  broken: 'broken',
};

// Same obstacle-tag and worry-category labels the Digest day modal shows, so
// the export reads with the app's own wording rather than the raw stored codes.
const TAG_LABELS: Record<string, string> = {
  Situation: 'Situation / Events',
  Outcome: 'Outcome / Results',
  People: 'People / Frictions',
  Time: 'Time / Delays',
  Limitation: 'Limitation / Constraints',
};
const WORRY_CATEGORY_LABELS: Record<Worry['category'], string> = {
  'up-to-me': 'Up to Me',
  'not-up-to-me': 'Not Up to Me',
  unassigned: 'Unassigned',
};

export interface DigestExportMeta {
  exportedAt: string; // YYYY-MM-DD
}

// A day is worth exporting only if something was actually captured on it — the
// same test the day modal uses to decide "No reflection recorded". Empty
// scaffold days (which the Digest still lists as "No entry") are skipped so the
// export is a genuine archive of captured entries, not a day-by-day skeleton.
function dayHasContent(
  r: ReflectionRecord | null,
  dayWorries: Worry[],
  commitments: Commitment[] = []
): boolean {
  return (
    dayWorries.length > 0 ||
    commitments.length > 0 ||
    !!(r && (r.text || r.morningIntentions || r.fateInput || r.mood || r.virtue || (r.passions && r.passions.length > 0)))
  );
}

function worriesForDay(worries: Worry[], date: string): Worry[] {
  return worries.filter((w) => w.createdAt === date);
}

/** Every recorded day in the digest, in the same (newest-first) order the
 *  on-screen Digest lists them, with its joined worries attached. */
export function collectRecordedDays(entries: DigestEntry[], worries: Worry[]): DayDigestEntry[] {
  return entries.filter(
    (e): e is DayDigestEntry =>
      e.type === 'day' && dayHasContent(e.reflection, worriesForDay(worries, e.date), e.commitments)
  );
}

// Human-readable Markdown archive — mirrors the Digest's structure (cycle and
// week markers interspersed with each recorded day) and each day's modal
// content, in the same newest-first order shown on screen.
export function buildDigestMarkdown(
  entries: DigestEntry[],
  worries: Worry[],
  meta: DigestExportMeta
): string {
  const recordedCount = collectRecordedDays(entries, worries).length;
  const lines: string[] = [
    '# Daily Stoic — Digest Export',
    '',
    `_Exported ${meta.exportedAt} · ${recordedCount} recorded ${recordedCount === 1 ? 'day' : 'days'}_`,
    '',
  ];

  for (const entry of entries) {
    if (entry.type === 'cycle') {
      const r = entry.retrospective;
      lines.push(
        '---',
        '',
        `## 🌟 Cycle ${entry.cycle} Complete`,
        '',
        `${r.dateRange.start} – ${r.dateRange.end} · ${r.consistencyRate}% consistency (${r.loggedCount}/28 days)`,
        '',
        `- Amor Fati reframes: ${r.reframingsCount}`,
        `- Passions tamed: ${r.passionsCount}`,
        `- Concerns cleared: ${r.worriesStats.resolved} of ${r.worriesStats.total} (${r.worriesStats.rate}%)`,
        `- Commitments kept: ${entry.ledger.kept} of ${entry.ledger.kept + entry.ledger.broken} reckoned (${entry.ledger.keptRate}%)`,
        ''
      );
    } else if (entry.type === 'week') {
      lines.push(
        `## Week ${entry.week} Complete — ${entry.virtue}`,
        '',
        `${entry.dateRange.start} – ${entry.dateRange.end} · ${entry.loggedCount} of 7 days logged`,
        ''
      );
      if (entry.ledger.total > 0) {
        lines.push(
          `Commitments: ${entry.ledger.kept} kept, ${entry.ledger.broken} broken, ${entry.ledger.open} open (${entry.ledger.keptRate}% kept)`,
          ''
        );
      }
      if (entry.quoteOfWeek) {
        lines.push(`> "${entry.quoteOfWeek.quote}" — ${entry.quoteOfWeek.author}`, '');
      }
    } else {
      const dayWorries = worriesForDay(worries, entry.date);
      if (!dayHasContent(entry.reflection, dayWorries, entry.commitments)) continue;
      const r = entry.reflection;

      lines.push(`### ${entry.label} (${entry.virtue}) — ${entry.date}${r?.favorite ? ' ⭐' : ''}`, '');

      const quote = getQuoteForDay(entry.day);
      lines.push('**Quote of the day**', `> "${quote.quote}" — ${quote.author}`, '');

      if (r?.morningIntentions) {
        lines.push('**Premeditatio Malorum**', r.morningIntentions, '');
      }

      const qa = parseReflectionQA(r?.text);
      if (qa.length > 0) {
        lines.push('**Evening Interrogation**');
        for (const block of qa) {
          lines.push(`- _${block.question}_`);
          if (block.answer) lines.push(`  ${block.answer}`);
        }
        lines.push('');
      } else if (r?.text) {
        lines.push('**Evening Interrogation**', r.text, '');
      }

      if (r?.mood) lines.push(`**Mood:** ${r.mood}`, '');

      if (dayWorries.length > 0) {
        lines.push('**Spheres of Choice**');
        for (const w of dayWorries) {
          lines.push(`- ${w.text} — ${WORRY_CATEGORY_LABELS[w.category]}${w.isResolved ? ' (resolved)' : ''}`);
        }
        lines.push('');
      }

      if (r?.fateInput) {
        lines.push('**Amor Fati reframe**', `> "${r.fateInput}"`);
        if (r.acceptanceTags && r.acceptanceTags.length > 0) {
          lines.push(`Tags: ${r.acceptanceTags.map((t) => TAG_LABELS[t] || t).join(', ')}`);
        }
        lines.push('');
      }

      if (r?.passions && r.passions.length > 0) {
        lines.push(`**Passions tamed:** ${r.passions.join(', ')}`, '');
      }

      if (entry.commitments.length > 0) {
        lines.push('**Commitments**');
        for (const c of entry.commitments) {
          lines.push(`- ${c.text} — ${COMMITMENT_STATUS_LABELS[c.status]}`);
        }
        lines.push('');
      }

      if (r?.virtue) lines.push(`**Virtue practiced:** ${r.virtue}`, '');
    }
  }

  return lines.join('\n').trim() + '\n';
}

// Complete, structured backup — every recorded day (with its full reflection
// record and worries), plus the completed-week and completed-cycle summaries.
// Empty scaffold days are omitted, matching the Markdown export.
export function buildDigestExportPayload(entries: DigestEntry[], worries: Worry[], meta: DigestExportMeta) {
  const days: unknown[] = [];
  const weeks: unknown[] = [];
  const cycles: unknown[] = [];

  for (const entry of entries) {
    if (entry.type === 'cycle') {
      cycles.push({ cycle: entry.cycle, ...entry.retrospective, ledger: entry.ledger });
    } else if (entry.type === 'week') {
      weeks.push({
        cycle: entry.cycle,
        week: entry.week,
        virtue: entry.virtue,
        dateRange: entry.dateRange,
        loggedCount: entry.loggedCount,
        quoteOfWeek: entry.quoteOfWeek,
        ledger: entry.ledger,
      });
    } else {
      const dayWorries = worriesForDay(worries, entry.date);
      if (!dayHasContent(entry.reflection, dayWorries, entry.commitments)) continue;
      days.push({
        day: entry.day,
        date: entry.date,
        cycle: entry.cycleInfo.cycle,
        week: entry.cycleInfo.week,
        dayOfWeek: entry.cycleInfo.dayOfWeek,
        virtue: entry.virtue,
        quote: getQuoteForDay(entry.day),
        reflection: entry.reflection,
        worries: dayWorries,
        commitments: entry.commitments,
      });
    }
  }

  return {
    app: 'Daily Stoic',
    kind: 'digest-export',
    version: 1,
    exportedAt: meta.exportedAt,
    recordedDays: days.length,
    days,
    weeks,
    cycles,
  };
}
