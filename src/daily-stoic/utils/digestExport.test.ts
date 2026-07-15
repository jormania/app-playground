import { describe, it, expect } from 'vitest';
import { buildDigestEntries } from './digest';
import { buildDigestMarkdown, buildDigestExportPayload, collectRecordedDays } from './digestExport';
import { ReflectionRecord } from '../services/NotionService';
import { Worry } from './retrospective';

const CYCLE_START = '2026-06-01';

function makeReflection(overrides: Partial<ReflectionRecord> & { date: string; quoteId: number }): ReflectionRecord {
  return {
    text: '',
    fateInput: '',
    acceptanceTags: [],
    favorite: false,
    mood: '',
    morningIntentions: '',
    passions: [],
    createdTime: '',
    dichotomy: '',
    virtue: '',
    ...overrides,
  };
}

// Day 1 is fully filled in; day 3 exists but is entirely blank (a scaffold day).
const reflections: ReflectionRecord[] = [
  makeReflection({
    date: '2026-06-01',
    quoteId: 1,
    text: '### What went well?\nStayed calm under pressure.',
    morningIntentions: 'Expect delays; meet them with patience.',
    mood: 'Good',
    fateInput: 'I cannot control the rain, but I embrace it as it is.',
    acceptanceTags: ['Situation'],
    passions: ['impatience'],
    virtue: 'Courage',
    favorite: true,
  }),
  makeReflection({ date: '2026-06-03', quoteId: 3 }),
];

const worries: Worry[] = [
  { id: 'w1', text: 'Prepare the talk', category: 'up-to-me', isResolved: true, createdAt: '2026-06-01' },
];

// today = 8 → Week 1 has fully completed, so a week marker is interspersed.
const entries = buildDigestEntries(8, CYCLE_START, reflections, worries);

describe('digest export', () => {
  it('counts only days with captured content as recorded', () => {
    expect(collectRecordedDays(entries, worries)).toHaveLength(1);
  });

  describe('buildDigestMarkdown', () => {
    const md = buildDigestMarkdown(entries, worries, { exportedAt: '2026-06-08' });

    it('has a header noting the export date and recorded-day count', () => {
      expect(md).toContain('# Daily Stoic — Digest Export');
      expect(md).toContain('1 recorded day');
    });

    it('renders the recorded day with every captured section', () => {
      expect(md).toContain('### Day 1 of Week 1 of Cycle 1 (Wisdom) — 2026-06-01 ⭐');
      expect(md).toContain('**Premeditatio Malorum**');
      expect(md).toContain('Expect delays; meet them with patience.');
      expect(md).toContain('**Evening Interrogation**');
      expect(md).toContain('_What went well?_');
      expect(md).toContain('Stayed calm under pressure.');
      expect(md).toContain('**Mood:** Good');
      expect(md).toContain('**Spheres of Choice**');
      expect(md).toContain('Prepare the talk — Up to Me (resolved)');
      expect(md).toContain('**Amor Fati reframe**');
      expect(md).toContain('Tags: Situation / Events');
      expect(md).toContain('**Passions tamed:** impatience');
      expect(md).toContain('**Virtue practiced:** Courage');
    });

    it('intersperses the completed week marker', () => {
      expect(md).toContain('## Week 1 Complete — Wisdom');
    });

    it('omits blank scaffold days entirely', () => {
      expect(md).not.toContain('2026-06-03');
    });
  });

  describe('buildDigestExportPayload', () => {
    const payload = buildDigestExportPayload(entries, worries, { exportedAt: '2026-06-08' }) as any;

    it('is a versioned digest-export envelope', () => {
      expect(payload.app).toBe('Daily Stoic');
      expect(payload.kind).toBe('digest-export');
      expect(payload.version).toBe(1);
      expect(payload.exportedAt).toBe('2026-06-08');
    });

    it('includes only recorded days, with their full reflection and worries', () => {
      expect(payload.recordedDays).toBe(1);
      expect(payload.days).toHaveLength(1);
      expect(payload.days[0].date).toBe('2026-06-01');
      expect(payload.days[0].reflection.mood).toBe('Good');
      expect(payload.days[0].worries).toHaveLength(1);
      expect(payload.days[0].quote).toBeTruthy();
    });

    it('captures the completed-week summary separately', () => {
      expect(payload.weeks.some((w: any) => w.week === 1 && w.virtue === 'Wisdom')).toBe(true);
    });
  });
});
