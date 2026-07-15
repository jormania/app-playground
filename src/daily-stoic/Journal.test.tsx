// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Journal from './Journal';
import * as NotionService from './services/NotionService';

// Node's own experimental `localStorage` global shadows happy-dom's implementation
// and reads as undefined without a --localstorage-file flag. Replace it with a
// minimal in-memory Storage so components reading/writing localStorage don't crash.
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
  birthDate: '',
  favoritedMaxims: [],
  onGoToSettings: () => {},
  quote: { quote: 'Test quote', author: 'Marcus Aurelius', source: 'Meditations', day: 2 },
  isCurrentQuoteFavorited: false,
  handleToggleFavorite: async () => {},
  handleShareQuote: async () => {},
  isSharing: false,
  isTogglingFavorite: false,
  hasPassionsProperty: true,
};

// Simulates the App-level `worries` prop: worries merged across every day's
// Notion page, used only to seed the aggregate dashboards — never today's editor.
const YESTERDAYS_WORRY = {
  id: 'w-yesterday',
  text: 'city noise',
  category: 'not-up-to-me' as const,
  createdAt: '2026-07-13',
};

function blankReflection(dichotomy: string) {
  return {
    id: 'page-2',
    text: '',
    fateInput: '',
    acceptanceTags: [],
    favorite: false,
    mood: '',
    morningIntentions: '',
    passions: [],
    createdTime: '',
    dichotomy,
    virtue: '',
  };
}

describe('Journal — worry day-scoping (regression for cross-day worry leakage)', () => {
  it('starts a fresh day empty even when the merged cross-day worries prop has entries', async () => {
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);

    render(<Journal {...baseProps} dayOfYear={2} worries={[YESTERDAYS_WORRY]} />);

    await waitFor(() => expect(NotionService.fetchReflectionForDay).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Syncing/i)).toBeNull());

    expect(screen.queryAllByText(/city noise/)).toHaveLength(0);
  });

  it("loads only the worries actually stored on that day's own Notion page, not the merged list", async () => {
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(
      blankReflection(JSON.stringify([{ id: 'w-today', text: 'Test worry', category: 'up-to-me', createdAt: '2026-07-14' }]))
    );

    render(<Journal {...baseProps} dayOfYear={2} worries={[YESTERDAYS_WORRY]} />);

    await waitFor(() => expect(screen.queryAllByText(/Test worry/).length).toBeGreaterThan(0));
    expect(screen.queryAllByText(/city noise/)).toHaveLength(0);
  });

  it("saving writes back exactly today's worries, never the merged cross-day list", async () => {
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockResolvedValue(blankReflection('[]'));

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} worries={[YESTERDAYS_WORRY]} />);

    await waitFor(() => expect(NotionService.fetchReflectionForDay).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('Log a worry/concern for today...'), 'Fresh concern');
    await user.click(screen.getByRole('button', { name: 'Record' }));

    // Jump to the Reflect step, where the save button lives.
    await user.click(screen.getByRole('button', { name: 'Reflect' }));
    await user.click(screen.getByRole('button', { name: /Complete Reflection/i }));

    await waitFor(() => expect(NotionService.upsertReflection).toHaveBeenCalled());

    const args = vi.mocked(NotionService.upsertReflection).mock.calls[0];
    const savedWorries = JSON.parse(args[12] as string);
    expect(savedWorries).toHaveLength(1);
    expect(savedWorries[0].text).toBe('Fresh concern');
  });

  it('saves the morning prep to Notion when leaving Prepare via Next, so it syncs even if Reflect is never completed', async () => {
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockResolvedValue(blankReflection('[]'));

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} worries={[]} />);

    await waitFor(() => expect(NotionService.fetchReflectionForDay).toHaveBeenCalled());

    // Do the morning's work on the Prepare step.
    await user.click(screen.getByRole('button', { name: 'Prepare' }));
    await user.type(
      screen.getByPlaceholderText(/Today I might face complaints/),
      'Expect delays; meet them calmly.'
    );
    await user.type(screen.getByPlaceholderText('Log a worry/concern for today...'), 'Fresh concern');
    await user.click(screen.getByRole('button', { name: 'Record' }));

    // Leaving Prepare via Next (before ever reaching Reflect) should commit it.
    await user.click(screen.getByRole('button', { name: /Next/ }));

    await waitFor(() => expect(NotionService.upsertReflection).toHaveBeenCalled());
    const args = vi.mocked(NotionService.upsertReflection).mock.calls[0];
    expect(args[10]).toBe('Expect delays; meet them calmly.'); // morningIntentions
    const savedWorries = JSON.parse(args[12] as string);
    expect(savedWorries).toHaveLength(1);
    expect(savedWorries[0].text).toBe('Fresh concern');
  });

  it('does not save when leaving Prepare with no morning-prep changes', async () => {
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(null);
    vi.mocked(NotionService.upsertReflection).mockResolvedValue(blankReflection('[]'));

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} worries={[]} />);

    await waitFor(() => expect(NotionService.fetchReflectionForDay).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Prepare' }));
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(NotionService.upsertReflection).not.toHaveBeenCalled();
  });

  it('the Reflect step shows both Up to Me and Not Up to Me sections for today\'s own worries', async () => {
    vi.mocked(NotionService.fetchReflectionForDay).mockResolvedValue(
      blankReflection(
        JSON.stringify([
          { id: 'w1', text: 'deadline pressure', category: 'up-to-me', createdAt: '2026-07-14' },
          { id: 'w2', text: 'traffic jam', category: 'not-up-to-me', createdAt: '2026-07-14' },
        ])
      )
    );

    const user = userEvent.setup();
    render(<Journal {...baseProps} dayOfYear={2} worries={[]} />);

    await waitFor(() => expect(screen.queryAllByText(/deadline pressure/).length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: 'Reflect' }));

    expect(screen.getByText('Resolve Actionable Concerns')).toBeTruthy();
    expect(screen.getByText("Reframe today's Externals")).toBeTruthy();
    expect(screen.queryAllByText(/deadline pressure/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/traffic jam/).length).toBeGreaterThan(0);
  });
});
