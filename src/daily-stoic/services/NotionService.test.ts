import { describe, it, expect, vi } from 'vitest';
import {
  normalizeNotionId,
  validateSchema,
  getMissingOptionalColumns,
  upgradeDatabaseSchema,
  fetchReflectionForDay,
  upsertReflection,
  fetchRecentReflections,
  fetchAllReflections
} from './NotionService';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('NotionService', () => {
  describe('normalizeNotionId', () => {
    it('extracts ID from Notion database URLs', () => {
      expect(
        normalizeNotionId(
          'https://www.notion.so/workspace/My-Database-41c42bc4dfb543f49051810b3c5880fe?v=123'
        )
      ).toBe('41c42bc4dfb543f49051810b3c5880fe');
    });

    it('handles bare IDs and hyphenated UUIDs', () => {
      expect(normalizeNotionId('41c42bc4dfb543f49051810b3c5880fe')).toBe('41c42bc4dfb543f49051810b3c5880fe');
      expect(normalizeNotionId('41c42bc4-dfb5-43f4-9051-810b3c5880fe')).toBe('41c42bc4dfb543f49051810b3c5880fe');
    });

    it('returns empty string if no ID matched', () => {
      expect(normalizeNotionId('not-a-valid-id')).toBe('');
    });
  });

  describe('validateSchema', () => {
    it('returns empty array when all properties exist and match type', () => {
      const validProps = {
        'Name': { type: 'title' },
        'QuoteID': { type: 'number' },
        'Reflection': { type: 'rich_text' },
        'Date': { type: 'date' },
        'AcceptanceTags': { type: 'multi_select' },
        'FateInput': { type: 'rich_text' },
        'Favorite': { type: 'checkbox' }
      };
      expect(validateSchema(validProps)).toEqual([]);
    });

    it('detects missing properties', () => {
      const invalidProps = {
        'Name': { type: 'title' },
        'QuoteID': { type: 'number' }
      };
      const errors = validateSchema(invalidProps);
      expect(errors).toContain('Missing property: "Reflection"');
      expect(errors).toContain('Missing property: "Date"');
      expect(errors).toContain('Missing property: "AcceptanceTags"');
      expect(errors).toContain('Missing property: "FateInput"');
      expect(errors).toContain('Missing property: "Favorite"');
    });

    it('detects type mismatches', () => {
      const invalidProps = {
        'Name': { type: 'title' },
        'QuoteID': { type: 'select' },
        'Reflection': { type: 'rich_text' },
        'Date': { type: 'date' },
        'AcceptanceTags': { type: 'multi_select' },
        'FateInput': { type: 'rich_text' },
        'Favorite': { type: 'number' } // should be checkbox
      };
      const errors = validateSchema(invalidProps);
      expect(errors).toContain('Property "QuoteID" must be of type "number" (found "select")');
      expect(errors).toContain('Property "Favorite" must be of type "checkbox" (found "number")');
    });
  });

  describe('getMissingOptionalColumns', () => {
    it('reports every optional column absent from an empty schema', () => {
      const missing = getMissingOptionalColumns({});
      expect(missing).toEqual(
        expect.arrayContaining(['Mood', 'MorningIntentions', 'Passions', 'Dichotomy', 'Virtue', 'Cycle', 'WeekOfCycle'])
      );
    });

    // Regression test: an earlier version of the auto-upgrade trigger in
    // App.tsx hand-listed only 4 of the 7 optional columns. A database that
    // already had those 4 (from an older upgrade) but not Cycle/WeekOfCycle
    // never triggered a re-upgrade, so upsertReflection's unconditional
    // write to Cycle/WeekOfCycle failed with "Cycle is not a property that
    // exists" on every save. This must catch that column pair specifically,
    // not just "is anything at all missing."
    it('still flags Cycle and WeekOfCycle as missing even when every other optional column is present', () => {
      const partiallyUpgradedProps = {
        'Mood': { type: 'select' },
        'MorningIntentions': { type: 'rich_text' },
        'Passions': { type: 'multi_select' },
        'Dichotomy': { type: 'rich_text' },
        'Virtue': { type: 'rich_text' },
      };
      expect(getMissingOptionalColumns(partiallyUpgradedProps)).toEqual(
        expect.arrayContaining(['Cycle', 'WeekOfCycle'])
      );
    });

    it('returns an empty array once every optional column is present', () => {
      const fullyUpgradedProps = {
        'Mood': { type: 'select' },
        'MorningIntentions': { type: 'rich_text' },
        'Passions': { type: 'multi_select' },
        'Dichotomy': { type: 'rich_text' },
        'Virtue': { type: 'rich_text' },
        'Cycle': { type: 'number' },
        'WeekOfCycle': { type: 'number' },
      };
      expect(getMissingOptionalColumns(fullyUpgradedProps)).toEqual([]);
    });
  });

  describe('upgradeDatabaseSchema', () => {
    it('PATCHes every optional column, including Cycle and WeekOfCycle, in one request', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ id: 'db-id', properties: {} }));
      await upgradeDatabaseSchema('mock-token', '41c42bc4dfb543f49051810b3c5880fe', fetchImpl);

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const body = JSON.parse((fetchImpl as any).mock.calls[0][1].body);
      expect(body.method).toBe('PATCH');
      expect(body.path).toBe('databases/41c42bc4dfb543f49051810b3c5880fe');
      expect(body.body.properties).toEqual({
        'Mood': { select: {} },
        'MorningIntentions': { rich_text: {} },
        'Passions': { multi_select: {} },
        'Dichotomy': { rich_text: {} },
        'Virtue': { rich_text: {} },
        'Cycle': { number: {} },
        'WeekOfCycle': { number: {} },
      });
    });
  });

  describe('fetchReflectionForDay', () => {
    it('returns parsed reflection when page is found', async () => {
      const mockResult = {
        results: [
          {
            id: 'page-123',
            properties: {
              Reflection: {
                rich_text: [{ plain_text: 'Stoic thoughts today.' }]
              },
              FateInput: {
                rich_text: [{ plain_text: 'Felt tired.' }]
              },
              AcceptanceTags: {
                multi_select: [{ name: 'Limitation' }]
              },
              Favorite: {
                checkbox: true
              }
            }
          }
        ]
      };

      const fetchImpl = vi.fn(async () => jsonResponse(mockResult));
      const res = await fetchReflectionForDay(
        'mock-token',
        '41c42bc4dfb543f49051810b3c5880fe',
        42,
        fetchImpl
      );

      expect(res).toEqual({
        id: 'page-123',
        text: 'Stoic thoughts today.',
        fateInput: 'Felt tired.',
        acceptanceTags: ['Limitation'],
        favorite: true,
        mood: '',
        morningIntentions: '',
        passions: [],
        createdTime: '',
        dichotomy: '',
        virtue: ''
      });
      expect(fetchImpl).toHaveBeenCalled();
    });

    it('returns null when no results are found', async () => {
      const mockResult = { results: [] };
      const fetchImpl = vi.fn(async () => jsonResponse(mockResult));
      const res = await fetchReflectionForDay(
        'mock-token',
        '41c42bc4dfb543f49051810b3c5880fe',
        42,
        fetchImpl
      );

      expect(res).toBeNull();
    });
  });

  describe('upsertReflection', () => {
    it('creates page (POST) when existingPageId is missing', async () => {
      const mockResult = {
        id: 'new-page-id',
        properties: {
          Reflection: { rich_text: [{ plain_text: 'New thoughts.' }] },
          FateInput: { rich_text: [{ plain_text: 'Lost keys.' }] },
          AcceptanceTags: { multi_select: [{ name: 'Outcome' }] },
          Favorite: { checkbox: true }
        }
      };

      const fetchImpl = vi.fn(async () => jsonResponse(mockResult));
      const res = await upsertReflection(
        'mock-token',
        '41c42bc4dfb543f49051810b3c5880fe',
        42,
        'New thoughts.',
        '2026-07-12',
        undefined,
        'Lost keys.',
        ['Outcome'],
        true,
        '',
        '',
        [],
        '',
        '',
        fetchImpl
      );

      expect(res).toEqual({
        id: 'new-page-id',
        text: 'New thoughts.',
        fateInput: 'Lost keys.',
        acceptanceTags: ['Outcome'],
        favorite: true,
        mood: '',
        morningIntentions: '',
        passions: [],
        createdTime: '',
        dichotomy: '',
        virtue: ''
      });

      const body = JSON.parse((fetchImpl as any).mock.calls[0][1].body);
      expect(body.method).toBe('POST');
      expect(body.path).toBe('pages');
      expect(body.body.properties.Favorite.checkbox).toBe(true);

      // Cycle/WeekOfCycle are derived from dayOfYear (42) via getCycleInfo:
      // day 42 falls in Cycle 2 (days 29-56), Week 2 (days 36-42 of the cycle).
      expect(body.body.properties.Cycle.number).toBe(2);
      expect(body.body.properties.WeekOfCycle.number).toBe(2);
    });

    it('updates page (PATCH) when existingPageId is provided', async () => {
      const mockResult = {
        id: 'existing-page-id',
        properties: {
          Reflection: { rich_text: [{ plain_text: 'Updated thoughts.' }] },
          FateInput: { rich_text: [{ plain_text: 'Heavy traffic.' }] },
          AcceptanceTags: { multi_select: [{ name: 'Time' }] },
          Favorite: { checkbox: false }
        }
      };

      const fetchImpl = vi.fn(async () => jsonResponse(mockResult));
      const res = await upsertReflection(
        'mock-token',
        '41c42bc4dfb543f49051810b3c5880fe',
        42,
        'Updated thoughts.',
        '2026-07-12',
        'existing-page-id',
        'Heavy traffic.',
        ['Time'],
        false,
        '',
        '',
        [],
        '',
        '',
        fetchImpl
      );

      expect(res).toEqual({
        id: 'existing-page-id',
        text: 'Updated thoughts.',
        fateInput: 'Heavy traffic.',
        acceptanceTags: ['Time'],
        favorite: false,
        mood: '',
        morningIntentions: '',
        passions: [],
        createdTime: '',
        dichotomy: '',
        virtue: ''
      });

      const body = JSON.parse((fetchImpl as any).mock.calls[0][1].body);
      expect(body.method).toBe('PATCH');
      expect(body.path).toBe('pages/existing-page-id');
    });
  });

  describe('fetchRecentReflections', () => {
    it('queries database and parses records', async () => {
      const mockResult = {
        results: [
          {
            id: 'page-abc',
            created_time: '2026-07-12T10:00:00Z',
            properties: {
              Date: { date: { start: '2026-07-12' } },
              QuoteID: { number: 42 },
              Reflection: { rich_text: [{ plain_text: 'Thoughts.' }] },
              FateInput: { rich_text: [{ plain_text: 'Forced.' }] },
              AcceptanceTags: { multi_select: [{ name: 'Limitation' }] },
              Favorite: { checkbox: true }
            }
          }
        ]
      };

      const fetchImpl = vi.fn(async () => jsonResponse(mockResult));
      const res = await fetchRecentReflections(
        'mock-token',
        '41c42bc4dfb543f49051810b3c5880fe',
        fetchImpl
      );

      expect(res).toEqual([
        {
          id: 'page-abc',
          date: '2026-07-12',
          quoteId: 42,
          text: 'Thoughts.',
          fateInput: 'Forced.',
          acceptanceTags: ['Limitation'],
          favorite: true,
          mood: '',
          morningIntentions: '',
          passions: [],
          createdTime: '2026-07-12T10:00:00Z',
          dichotomy: '',
          virtue: ''
        }
      ]);

      const body = JSON.parse((fetchImpl as any).mock.calls[0][1].body);
      expect(body.method).toBe('POST');
      expect(body.path).toBe('databases/41c42bc4dfb543f49051810b3c5880fe/query');
    });

    it('only fetches a single page, even if Notion reports more are available', async () => {
      const page = (quoteId: number) => ({
        id: `page-${quoteId}`,
        created_time: '2026-07-12T10:00:00Z',
        properties: {
          Date: { date: { start: '2026-07-12' } },
          QuoteID: { number: quoteId },
          Reflection: { rich_text: [] },
        },
      });
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ results: [page(1)], has_more: true, next_cursor: 'cursor-a' })
      );

      const res = await fetchRecentReflections('mock-token', '41c42bc4dfb543f49051810b3c5880fe', fetchImpl);

      expect(res).toHaveLength(1);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchAllReflections', () => {
    it('follows has_more/next_cursor until the full history is retrieved', async () => {
      const page = (quoteId: number) => ({
        id: `page-${quoteId}`,
        created_time: '2026-07-12T10:00:00Z',
        properties: {
          Date: { date: { start: '2026-07-12' } },
          QuoteID: { number: quoteId },
          Reflection: { rich_text: [] },
        },
      });

      let call = 0;
      const fetchImpl = vi.fn(async () => {
        call++;
        if (call === 1) return jsonResponse({ results: [page(3)], has_more: true, next_cursor: 'cursor-a' });
        if (call === 2) return jsonResponse({ results: [page(2)], has_more: true, next_cursor: 'cursor-b' });
        return jsonResponse({ results: [page(1)], has_more: false, next_cursor: null });
      });

      const res = await fetchAllReflections('mock-token', '41c42bc4dfb543f49051810b3c5880fe', fetchImpl);

      expect(fetchImpl).toHaveBeenCalledTimes(3);
      expect(res.map((r) => r.quoteId)).toEqual([3, 2, 1]);

      // The second and third requests must pass the cursor from the previous response.
      const secondBody = JSON.parse((fetchImpl as any).mock.calls[1][1].body);
      expect(secondBody.body.start_cursor).toBe('cursor-a');
      const thirdBody = JSON.parse((fetchImpl as any).mock.calls[2][1].body);
      expect(thirdBody.body.start_cursor).toBe('cursor-b');
    });

    it('stops after a single page when has_more is false', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({
          results: [{ id: 'page-1', properties: { Date: { date: { start: '2026-07-12' } }, QuoteID: { number: 1 }, Reflection: { rich_text: [] } } }],
          has_more: false,
        })
      );

      const res = await fetchAllReflections('mock-token', '41c42bc4dfb543f49051810b3c5880fe', fetchImpl);

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(res).toHaveLength(1);
    });
  });
});
