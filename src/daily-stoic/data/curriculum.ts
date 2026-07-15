// Enhance 2 — the Path. The 28-day cycle's four virtue-weeks are overlaid with
// Epictetus's three disciplines (as transmitted by Hadot and modern practitioners):
// the Discipline of Desire (orexis — what we want and are averse to), the
// Discipline of Action (hormê — how we act toward others), and the Discipline of
// Assent (sunkatathesis — how we judge our impressions). Two weeks land on Desire
// deliberately: Epictetus's discipline of desire governs both craving (Temperance)
// and aversion/fear (Courage).
//
// All teaching text here is written plainly in our own words and quotes only the
// ancient Stoics (public domain) — never any modern book. See lib/curriculum.ts
// for the accessors and lib/mentor.ts for how the mentor teaches from this.

import { WeekVirtue } from '../utils/date';

export type Discipline = 'Desire' | 'Action' | 'Assent';

export interface WeekCurriculum {
  week: number; // 1–4 within a cycle
  virtue: WeekVirtue;
  discipline: Discipline;
  disciplineGreek: string;
  title: string;
  teaching: string;
  practice: string;
  focusQuestion: string;
}

export const DISCIPLINE_SUMMARY: Record<Discipline, { greek: string; gloss: string }> = {
  Desire: { greek: 'orexis', gloss: 'wanting and being averse rightly — desiring only what is up to you, accepting the rest' },
  Action: { greek: 'hormê', gloss: 'acting rightly toward others — with justice, patience, and duty to the common good' },
  Assent: { greek: 'sunkatathesis', gloss: 'judging impressions rightly — testing what appears before you believe or react to it' },
};

// Indexed by week (1–4), matching WEEK_VIRTUES order in utils/date.ts
// (Wisdom, Courage, Justice, Temperance).
export const CURRICULUM: WeekCurriculum[] = [
  {
    week: 1,
    virtue: 'Wisdom',
    discipline: 'Assent',
    disciplineGreek: 'sunkatathesis',
    title: 'See clearly before you judge',
    teaching:
      'Wisdom begins at the gate of assent: the instant an impression arrives, you decide whether to believe it. Most suffering is not caused by events but by the hasty verdict you pass on them. This week, slow that verdict down — notice the raw fact, then the story you add to it.',
    practice:
      'Once a day, catch an impression before you react. Name the bare fact, strip the judgement off it, and only then choose your response.',
    focusQuestion: 'What did I take to be true today that was only my impression of it?',
  },
  {
    week: 2,
    virtue: 'Courage',
    discipline: 'Desire',
    disciplineGreek: 'orexis',
    title: 'Master your aversions',
    teaching:
      'Courage is the discipline of desire turned toward what you fear. We are ruled less by what we want than by what we cannot bear to face. This week, walk toward one thing your aversion keeps steering you away from — the discomfort is the training, not the obstacle.',
    practice:
      'Each day, do one small thing you are avoiding out of fear or discomfort. Let the reluctance be the signal, not the veto.',
    focusQuestion: 'What did I avoid today, and what was I really afraid of?',
  },
  {
    week: 3,
    virtue: 'Justice',
    discipline: 'Action',
    disciplineGreek: 'hormê',
    title: 'Act for the common good',
    teaching:
      'Justice is the discipline of action: we are made for one another, and virtue shows itself in how we treat the people in front of us. This week, aim your impulses outward — fairness, patience with the difficult, a debt of kindness paid without being asked.',
    practice:
      'Each day, perform one deliberate act of justice or service — small, unshowy, and for its own sake.',
    focusQuestion: 'Where today did I put my own comfort ahead of what was fair to another?',
  },
  {
    week: 4,
    virtue: 'Temperance',
    discipline: 'Desire',
    disciplineGreek: 'orexis',
    title: 'Want rightly, release the rest',
    teaching:
      'Temperance is the discipline of desire turned toward craving. The Stoic is not starved of pleasure but ungoverned by it. This week, practise the reserve: enjoy what comes, grasp at nothing, and rehearse doing without — so that no comfort becomes a master.',
    practice:
      'Each day, deny yourself one comfort you would ordinarily reach for automatically, and notice you are still whole without it.',
    focusQuestion: 'What comfort did I reach for today out of habit rather than choice?',
  },
];

// Contextual just-in-time wisdom (Enhance 3): the right ancient maxim for the
// passion that is flaring. Keyed by the passion ids in data/passions.ts. Quotes
// are ancient Stoics only (public domain), consistent with the rest of the app.
export const PASSION_WISDOM: Record<string, { maxim: string; author: string }> = {
  impatience: {
    maxim: 'How much more grievous are the consequences of anger than the causes of it.',
    author: 'Marcus Aurelius',
  },
  anxiety: {
    maxim: 'We suffer more often in imagination than in reality.',
    author: 'Seneca',
  },
  reputation: {
    maxim: 'If you are ever tempted to look for outside approval, realize that you have compromised your integrity.',
    author: 'Epictetus',
  },
  discontent: {
    maxim: 'He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.',
    author: 'Epictetus',
  },
  pride: {
    maxim: 'It is impossible for a man to learn what he thinks he already knows.',
    author: 'Epictetus',
  },
  craving: {
    maxim: 'Wealth consists not in having great possessions, but in having few wants.',
    author: 'Epictetus',
  },
};
