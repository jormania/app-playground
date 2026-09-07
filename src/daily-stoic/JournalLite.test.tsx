// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Journal from './Journal';
import * as NotionService from './services/NotionService';
import { JOURNAL_MODE_KEY } from './lib/useJournalMode';
import { REFLECTION_PROMPTS } from './utils/lite';
import { getWeekCurriculum } from './lib/curriculum';

// Same shim as Journal.test.tsx — Node's experimental localStorage global
// shadows happy-dom's and reads as undefined.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

vi.mock('./services/NotionService', async () => {
  const actual = await vi.importActual<typeof import('./services/NotionService')>('./services/NotionService');
  return {
    ...actual,
    fetchReflectionForDay: vi.fn(),
    upsertReflection: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

const baseProps = {
  token: 'test-token',
  databaseId: 'test-db',
  birthDate: '1976-09-23',
  favoritedMaxims: [],
  onGoToSettings: () => {},
  quote: { quote: 'Test quote', author: 'Marcus Aurelius', source: 'Meditations', day: 2 },
  isCurrentQuoteFavorited: false,
  handleToggleFavorite: async () => {},
  handleShareQuote: async () => {},
  isSharing: false,
  isTogglingFavorite: false,
  hasPassionsProperty: true,
  worries: [],
};

// A day already written in the FULL journal — everything Lite doesn't render.
const FULL_DAY_WORRIES = JSON.stringify([
  { id: 'w1', text: 'the deadline', category: 'up-to-me', createdAt: '2026-07-14' },
]);

function fullDayRecord(overrides: Partial<NotionService.NotionReflection> = {}): NotionService.NotionReflection {
  return {
    id: 'page-2',
    text: 'An earlier reflection.',
    fateInput: 'a flight delay',
    acceptanceTags: ['Time'],
    favorite: false,
    mood: 'Good',
    morningIntentions: 'Expect delays; meet them calmly.',
    passions: ['impatience'],
    createdTime: '',
    dichotomy: FULL_DAY_WORRIES,
    virtue: 'Courage',
    ...overrides,
  };
}

const REFLECTION_PROMPT = 'What happened today, and how did you meet it?';

/** A record with nothing in the fields Lite doesn't render — what the relay
 *  echoes back for a day that has only ever been written in Lite. */
function emptyDayRecord(overrides: Partial<NotionService.NotionReflection> = {}): NotionService.NotionReflection {
  return fullDayRecord({
    text: '',
    fateInput: '',
    acceptanceTags: [],
    mood: '',
    morningIntentions: '',
    passions: [],
    dichotomy: '[]',
    virtue: '',
    ...overrides,
  });
}

function enableLite() {
  localStorage.setItem(JOURNAL_MODE_KEY, 'lite');
}

describe('Journal — Lite mode', () => {
  it('defaults to the full journal when no mode has been set', async () => {
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    render(<Journal {...baseProps} dayOfYear={2} />);

    await waitFor(() => expect(NotionService.fetchReflectionForDay).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Prepare' })).toBeTruthy();
    expect(screen.queryByPlaceholderText(REFLECTION_PROMPT)).toBeNull();
  });

  it('renders one screen — Memento Mori, the maxim, Amor Fati, a reflection and a mood — with no stepper', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    render(<Journal {...baseProps} dayOfYear={2} />);

    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    // The four-step journey is gone.
    expect(screen.queryByRole('button', { name: 'Prepare' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Meditate' })).toBeNull();

    // Memento Mori as a lifetime bar, not the 4,160-block grid.
    const bar = screen.getByRole('progressbar', { name: /Lifespan elapsed/i });
    expect(bar.getAttribute('aria-valuemax')).toBe('4160');
    expect(screen.getByText(/weeks lived/i)).toBeTruthy();

    expect(screen.getByText('Test quote')).toBeTruthy();
    // Amor Fati starts folded — one line, not the tallest card on the screen.
    expect(screen.getByRole('button', { name: /Something heavy today/ })).toBeTruthy();
    expect(screen.queryByLabelText('What feels forced or heavy?')).toBeNull();
    expect(screen.getByPlaceholderText(REFLECTION_PROMPT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Great' })).toBeTruthy();

    // The heavy morning half is not on the screen at all.
    expect(screen.queryByPlaceholderText(/Today I might face complaints/)).toBeNull();
    expect(screen.queryByPlaceholderText('Log a worry/concern for today...')).toBeNull();
    expect(screen.queryByText('Passions & Judgments')).toBeNull();
  });

  it('anchors the week with its virtue, its framing line and the week\'s maxim', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);

    // Day 2 sits in week 1 of the cycle — themed Wisdom.
    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    expect(screen.getByText(/This week · Wisdom/)).toBeTruthy();
    expect(screen.getByText(getWeekCurriculum(1).title)).toBeTruthy();

    // Day 9 is week 2 — Courage — and the framing follows.
    cleanup();
    render(<Journal {...baseProps} dayOfYear={9} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());
    expect(screen.getByText(/This week · Courage/)).toBeTruthy();
    expect(screen.getByText(getWeekCurriculum(2).title)).toBeTruthy();
  });

  it('prompts for a birth date instead of a bar when none is configured', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    render(<Journal {...baseProps} birthDate="" dayOfYear={2} />);

    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());
    expect(screen.getByText(/Set your birth date/i)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('preserves every field it does not render when saving a day written in Full', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(fullDayRecord());
    vi.mocked(NotionService.upsertReflection).mockResolvedValue(fullDayRecord());

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);

    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    await user.type(screen.getByPlaceholderText(REFLECTION_PROMPT), ' Then this.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(NotionService.upsertReflection).toHaveBeenCalled());
    const args = vi.mocked(NotionService.upsertReflection).mock.calls[0];
    expect(args[3]).toBe('An earlier reflection. Then this.'); // text
    expect(args[9]).toBe('Good'); // mood
    expect(args[10]).toBe('Expect delays; meet them calmly.'); // morningIntentions
    expect(args[11]).toEqual(['impatience']); // passions
    expect(JSON.parse(args[12] as string)).toHaveLength(1); // dichotomy worries
    expect(args[13]).toBe('Courage'); // virtue
  });

  it('saves the reflection verbatim, with no Seneca question headers', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockResolvedValue(fullDayRecord({ text: 'A plain line.' }));

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);

    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    await user.type(screen.getByPlaceholderText(REFLECTION_PROMPT), 'A plain line.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(NotionService.upsertReflection).toHaveBeenCalled());
    const args = vi.mocked(NotionService.upsertReflection).mock.calls[0];
    expect(args[3]).toBe('A plain line.');
    expect(args[3]).not.toContain('###');
  });

  it('keeps Amor Fati to a single challenge type and saves it', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockResolvedValue(fullDayRecord());

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);

    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    await user.click(screen.getByRole('button', { name: /Something heavy today/ }));
    await user.type(screen.getByLabelText('What feels forced or heavy?'), 'a cancelled train');
    await user.click(screen.getByRole('button', { name: /Time/ }));
    await user.click(screen.getByRole('button', { name: /People/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(NotionService.upsertReflection).toHaveBeenCalled());
    const args = vi.mocked(NotionService.upsertReflection).mock.calls[0];
    expect(args[6]).toBe('a cancelled train'); // fateInput
    expect(args[7]).toEqual(['People']); // second tap replaces, never accumulates
  });

  it('opens the full practice for one day and lets that day go back to Lite', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);

    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    await user.click(screen.getByRole('button', { name: /Do the full practice today/ }));
    expect(screen.getByRole('button', { name: 'Prepare' })).toBeTruthy();
    // Scoped to this day only — the setting itself is untouched.
    expect(localStorage.getItem('daily-stoic:full-day-2')).toBe('true');
    expect(localStorage.getItem(JOURNAL_MODE_KEY)).toBe('lite');

    await user.click(screen.getByRole('button', { name: /Back to Lite/ }));
    expect(screen.getByPlaceholderText(REFLECTION_PROMPT)).toBeTruthy();
    expect(localStorage.getItem('daily-stoic:full-day-2')).toBeNull();
  });

  it('surfaces a past obstacle once the day is saved, and not before', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(fullDayRecord());
    // Echo the saved text back, as the real relay does — otherwise the record
    // reads as still-dirty after saving.
    vi.mocked(NotionService.upsertReflection).mockImplementation(
      async (_token, _db, _day, text) => fullDayRecord({ text })
    );

    const past = [{ id: 'old', date: '2026-04-15', quoteId: 70, fateInput: 'a missed train' }];

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={100} recentReflections={past} />);

    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    // Freshly loaded and unchanged, the day counts as saved — the card is there.
    expect(screen.getByText(/30 days ago/)).toBeTruthy();

    // While there are unsaved edits it steps out of the way.
    await user.type(screen.getByPlaceholderText(REFLECTION_PROMPT), ' more');
    expect(screen.queryByText(/30 days ago/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText(/30 days ago/)).toBeTruthy());
    expect(screen.getByText(/a missed train/)).toBeTruthy();
  });
});

describe('Journal — Lite, day to day', () => {
  it('saves the moment a mood is tapped, so one tap is a complete day', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockImplementation(
      async (_t, _d, _q, text, _date, _id, fate, tags, _fav, mood) =>
        emptyDayRecord({ text, fateInput: fate, acceptanceTags: tags, mood })
    );

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Good' }));

    await waitFor(() => expect(NotionService.upsertReflection).toHaveBeenCalled());
    // The mood the user just tapped, not the one in stale state.
    expect(vi.mocked(NotionService.upsertReflection).mock.calls[0][9]).toBe('Good');
    await waitFor(() => expect(screen.getByRole('button', { name: '✓ Saved' })).toBeTruthy());
  });

  it('shows the week as seven dots and fills today on save', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockImplementation(
      async (_t, _d, _q, text, _date, _id, _f, _tg, _fav, mood) => emptyDayRecord({ text, mood })
    );

    // Day 10 sits in the week of days 8-14; day 8 already holds something.
    const past = [{ id: 'a', date: '2026-07-20', quoteId: 8, text: 'wrote then' }];
    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={10} recentReflections={past} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    expect(screen.getByLabelText('This week: 1 of 7 days written')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Great' }));
    await waitFor(() => expect(screen.getByLabelText('This week: 2 of 7 days written')).toBeTruthy());
  });

  it('threads yesterday under the dots', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    const past = [{ id: 'y', date: '2026-07-21', quoteId: 9, text: 'A quiet day.' }];

    render(<Journal {...baseProps} dayOfYear={10} recentReflections={past} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    expect(screen.getByText(/Yesterday: “A quiet day.”/)).toBeTruthy();
  });

  it('lets a long yesterday scroll sideways instead of cutting it off', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    const long = 'I cannot control the heat, the noise from the street, or how late the meeting ran, but I embrace them as they are.';
    const past = [{ id: 'y', date: '2026-07-21', quoteId: 9, text: long }];

    render(<Journal {...baseProps} dayOfYear={10} recentReflections={past} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    const line = screen.getByText(new RegExp(long.slice(0, 40)));
    // The whole sentence is in the DOM, on one unwrapped line...
    expect(line.textContent).toContain(long);
    expect(line.className).toContain('whitespace-nowrap');
    expect(line.className).not.toContain('truncate');
    // ...inside a strip that scrolls, so the page itself never does.
    const strip = line.parentElement!;
    expect(strip.className).toContain('overflow-x-auto');
    // Shrinkable inside the flex row it shares with the dots — without
    // min-w-0 a nowrap child pushes the whole row wider instead of scrolling.
    expect(strip.className).toContain('min-w-0');
    expect(strip.parentElement?.querySelector('[role="img"]')).toBeTruthy();
  });

  it('drifts on its own only when the line actually overflows', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    const past = [{ id: 'y', date: '2026-07-21', quoteId: 9, text: 'Short.' }];

    render(<Journal {...baseProps} dayOfYear={10} recentReflections={past} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    // happy-dom reports no layout, so scrollWidth is 0 and nothing overflows —
    // exactly the case where the line must sit still rather than drift.
    const line = screen.getByText(/Yesterday: “Short.”/);
    expect(line.className).not.toContain('ticker-line');
    expect(line.getAttribute('style')).toBeNull();
  });

  it('keeps Amor Fati folded until asked, and unfolds it for a day that has one', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    expect(screen.queryByLabelText('What feels forced or heavy?')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Something heavy today/ }));
    expect(screen.getByLabelText('What feels forced or heavy?')).toBeTruthy();

    cleanup();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(fullDayRecord());
    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());
    // Already carries an obstacle — it opens on its own.
    expect(screen.getByLabelText('What feels forced or heavy?')).toBeTruthy();
  });

  it('drops a question into the blank box, then offers another', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    const box = screen.getByPlaceholderText(REFLECTION_PROMPT) as HTMLTextAreaElement;
    expect(box.value).toBe('');

    await user.click(screen.getByRole('button', { name: 'Give me a question' }));
    const first = box.value.trim();
    expect(REFLECTION_PROMPTS).toContain(first);

    await user.click(screen.getByRole('button', { name: 'Another question' }));
    expect(box.value.trim().split('\n\n')).toHaveLength(2);
  });
});

describe('Journal — Lite, audit fixes', () => {
  it('fills the dot for a day whose only entry is a challenge type', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockImplementation(
      async (_t, _d, _q, text, _date, _id, fate, tags) =>
        emptyDayRecord({ text, fateInput: fate, acceptanceTags: tags })
    );

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    await user.click(screen.getByRole('button', { name: /Something heavy today/ }));
    await user.click(screen.getByRole('button', { name: /Time/ }));

    // The tag alone is a change worth saving, and it says so.
    expect(screen.getByText(/Unsaved changes/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Stats and the streak count a tagged day; the dot must agree.
    await waitFor(() => expect(screen.getByLabelText('This week: 1 of 7 days written')).toBeTruthy());
  });

  it('clears a mis-tapped mood when the same face is tapped again', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockImplementation(
      async (_t, _d, _q, text, _date, _id, _f, _tg, _fav, mood) => emptyDayRecord({ text, mood })
    );

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    const good = screen.getByRole('button', { name: 'Good' });
    await user.click(good);
    await waitFor(() => expect(good.getAttribute('aria-pressed')).toBe('true'));

    await user.click(good);
    await waitFor(() => expect(good.getAttribute('aria-pressed')).toBe('false'));

    // The clearing save wrote an empty mood, and the day is unlogged again.
    const calls = vi.mocked(NotionService.upsertReflection).mock.calls;
    expect(calls[calls.length - 1]![9]).toBe('');
    await waitFor(() => expect(screen.getByLabelText('This week: 0 of 7 days written')).toBeTruthy());
  });

  it('does not claim a blank day is saved', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);

    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    // Nothing has ever been written for this day, so "✓ Saved" would be a lie.
    expect(screen.queryByRole('button', { name: '✓ Saved' })).toBeNull();
    const save = screen.getByRole('button', { name: 'Save' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it('names the day behind each dot rather than its cycle number', async () => {
    enableLite();
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    localStorage.setItem('daily-stoic:cycle-start-date', '2026-09-07');

    render(<Journal {...baseProps} dayOfYear={2} />);
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    const row = screen.getByLabelText(/This week: /);
    const titles = Array.from(row.querySelectorAll('span')).map((el) => el.getAttribute('title'));
    expect(titles).toContain('Today');
    expect(titles.some((t) => t && /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/.test(t))).toBe(true);
    expect(titles.some((t) => t && /^Day \d+$/.test(t))).toBe(false);
  });
});
