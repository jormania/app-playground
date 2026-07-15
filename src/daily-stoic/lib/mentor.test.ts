import { describe, it, expect, vi } from 'vitest';
import {
  buildMorningChallengePrompt,
  buildEveningReckoningPrompt,
  buildPatternInterventionPrompt,
  buildCouncilPrompt,
  buildCharacterArcPrompt,
  requestMentor,
  verifyAnthropicKey,
} from './mentor';

describe('buildMorningChallengePrompt', () => {
  it('folds in the premeditatio, sorted worries, and unpaid debts, and ends in a demand', () => {
    const { system, user } = buildMorningChallengePrompt({
      cycle: 2,
      week: 3,
      virtue: 'Courage',
      premeditatio: 'A tense review with my manager',
      worries: [
        { text: 'the review outcome', category: 'not-up-to-me' },
        { text: 'my own preparation', category: 'up-to-me' },
      ],
      openDebts: [{ text: 'call the dentist', ageDays: 2 }],
      keptRate: 80,
      reckonedCount: 5,
    });
    expect(system).toContain('Socratic');
    expect(user).toContain('week 3 of cycle 2');
    expect(user).toContain('Courage');
    expect(user).toContain('tense review');
    expect(user).toContain('"the review outcome" (not up to them)');
    expect(user).toContain('"my own preparation" (up to them)');
    expect(user).toContain('call the dentist');
    expect(user).toContain('2 days old');
    expect(user).toContain('kept 80%');
    expect(user).toMatch(/demand ONE specific/i);
  });

  it('handles an empty morning gracefully', () => {
    const { user } = buildMorningChallengePrompt({
      cycle: 1,
      week: 1,
      virtue: 'Wisdom',
      premeditatio: '',
      worries: [],
      openDebts: [],
      keptRate: 0,
      reckonedCount: 0,
    });
    expect(user).toContain('have not written');
    expect(user).not.toContain('kept 0%'); // suppressed when nothing reckoned yet
  });

  it('singularises a one-day-old debt', () => {
    const { user } = buildMorningChallengePrompt({
      cycle: 1,
      week: 1,
      virtue: 'Wisdom',
      premeditatio: 'x',
      worries: [],
      openDebts: [{ text: 'thing', ageDays: 1 }],
      keptRate: 0,
      reckonedCount: 0,
    });
    expect(user).toContain('1 day old');
  });
});

describe('buildEveningReckoningPrompt', () => {
  it('separates kept from broken, surfaces broken reasons, and demands the next move', () => {
    const { user } = buildEveningReckoningPrompt({
      cycle: 1,
      week: 2,
      virtue: 'Temperance',
      reckonings: [
        { text: 'no phone before noon', status: 'kept' },
        { text: 'gym at six', status: 'broken', note: 'stayed late at work' },
      ],
      stillOpen: [{ text: 'email reply', ageDays: 0 }],
      reflection: 'Which of my bad habits did I catch? I stopped complaining.',
      mood: 'Good',
      passions: ['Impatience & Anger'],
      reframes: ['the weather'],
    });
    expect(user).toContain('Promises they kept today: "no phone before noon"');
    expect(user).toContain('Promises they broke today');
    expect(user).toContain('stayed late at work');
    expect(user).toContain('left unreckoned');
    expect(user).toContain('mood: Good');
    expect(user).toContain('Impatience & Anger');
    expect(user).toContain('the weather');
    expect(user).toContain('I stopped complaining');
    expect(user).toMatch(/single promise for\s+tomorrow|question they must sit with/i);
  });

  it('states plainly when no promise was made', () => {
    const { user } = buildEveningReckoningPrompt({
      cycle: 1,
      week: 1,
      virtue: 'Justice',
      reckonings: [],
      stillOpen: [],
      reflection: '',
      mood: '',
      passions: [],
      reframes: [],
    });
    expect(user).toContain('made no promise to keep today');
  });
});

describe('buildPatternInterventionPrompt', () => {
  it('names the recurring passions and kept-rate and asks for a single discipline', () => {
    const { user } = buildPatternInterventionPrompt({
      span: 'the last 28 days',
      virtue: 'Courage',
      topPassions: [
        { label: 'Anxiety & Fear', count: 9 },
        { label: 'Pride & Ego', count: 1 },
      ],
      keptRate: 55,
      reckonedCount: 11,
      recentBroken: ['ship the draft'],
    });
    expect(user).toContain('the last 28 days');
    expect(user).toContain('Anxiety & Fear (9 times)');
    expect(user).toContain('Pride & Ego (1 time)');
    expect(user).toContain('kept 55%');
    expect(user).toContain('ship the draft');
    expect(user).toMatch(/single, concrete discipline/i);
  });
});

describe('buildCouncilPrompt', () => {
  it('convenes the week data and charges the next week', () => {
    const { user } = buildCouncilPrompt({
      cycle: 1,
      week: 2,
      virtue: 'Courage',
      discipline: 'Desire',
      disciplineGloss: 'wanting and being averse rightly',
      focusQuestion: 'What did I avoid today?',
      daysLogged: 5,
      daysInSpan: 7,
      keptRate: 60,
      reckonedCount: 5,
      brokenPromises: ['gym at six'],
      topPassions: [{ label: 'Anxiety & Fear', count: 4 }],
      dominantMood: 'Neutral',
    });
    expect(user).toContain('Week 2 of cycle 1');
    expect(user).toContain('virtue of Courage through the discipline of Desire');
    expect(user).toContain('5 of 7 days');
    expect(user).toContain('kept 60%');
    expect(user).toContain('gym at six');
    expect(user).toContain('Anxiety & Fear (4)');
    expect(user).toContain('What did I avoid today?');
    expect(user).toMatch(/charge\s+them with one concrete discipline/i);
  });
});

describe('buildCharacterArcPrompt', () => {
  it('speaks to the arc and ends in an enduring question', () => {
    const { user } = buildCharacterArcPrompt({
      span: 'all 3 cycles',
      cyclesCompleted: 3,
      daysPracticed: 70,
      keptRate: 72,
      reckonedCount: 40,
      recurringPassions: [{ label: 'Craving & Attachment', count: 12 }],
      strongestVirtue: 'Temperance',
    });
    expect(user).toContain('70 days across 3 completed cycles');
    expect(user).toContain('kept 72%');
    expect(user).toContain('Craving & Attachment (12)');
    expect(user).toContain('Temperance');
    expect(user).toMatch(/through-line/i);
  });

  it('singularises a single completed cycle', () => {
    const { user } = buildCharacterArcPrompt({
      span: 'cycle 1',
      cyclesCompleted: 1,
      daysPracticed: 20,
      keptRate: 0,
      reckonedCount: 0,
      recurringPassions: [],
    });
    expect(user).toContain('1 completed cycle');
    expect(user).not.toContain('completed cycles');
  });
});

describe('requestMentor', () => {
  const okResponse = (text: string) =>
    ({ ok: true, json: async () => ({ content: [{ text }] }) }) as unknown as Response;

  it('posts to Anthropic with the direct-browser header and the user key, returns trimmed text', async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        okResponse('  Answer this. What are you avoiding?  '),
    );
    const out = await requestMentor(
      'sk-ant-123',
      { system: 'S', user: 'U' },
      fetchMock as unknown as typeof fetch,
    );
    expect(out).toBe('Answer this. What are you avoiding?');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-123');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse((init?.body as string) ?? '{}');
    expect(body.system).toBe('S');
    expect(body.messages[0].content).toBe('U');
  });

  it('throws before calling when the key is blank', async () => {
    const fetchMock = vi.fn();
    await expect(
      requestMentor('  ', { system: 's', user: 'u' }, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/Add your Anthropic key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps status codes to calm messages', async () => {
    const withStatus = (status: number) =>
      vi.fn(async () => ({ ok: false, status }) as unknown as Response) as unknown as typeof fetch;
    await expect(requestMentor('k', { system: 's', user: 'u' }, withStatus(401))).rejects.toThrow(/rejected the key/);
    await expect(requestMentor('k', { system: 's', user: 'u' }, withStatus(429))).rejects.toThrow(/rate-limited/);
    await expect(requestMentor('k', { system: 's', user: 'u' }, withStatus(500))).rejects.toThrow(/having trouble/);
  });

  it('throws when the model returns empty content', async () => {
    const fetchMock = vi.fn(async () => okResponse('   ')) as unknown as typeof fetch;
    await expect(requestMentor('k', { system: 's', user: 'u' }, fetchMock)).rejects.toThrow(/nothing to say/);
  });
});

describe('verifyAnthropicKey', () => {
  it('rejects a blank key without a network call', async () => {
    const fetchMock = vi.fn();
    await expect(verifyAnthropicKey('', fetchMock as unknown as typeof fetch)).rejects.toThrow(/Add your Anthropic key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves on an ok response and throws a calm error otherwise', async () => {
    const ok = vi.fn(async () => ({ ok: true }) as unknown as Response) as unknown as typeof fetch;
    await expect(verifyAnthropicKey('k', ok)).resolves.toBeUndefined();
    const bad = vi.fn(async () => ({ ok: false, status: 401 }) as unknown as Response) as unknown as typeof fetch;
    await expect(verifyAnthropicKey('k', bad)).rejects.toThrow(/rejected the key/);
  });
});
