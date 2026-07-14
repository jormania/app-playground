import { describe, it, expect, vi } from 'vitest';
import {
  normalizeNotionId,
  validateSchema,
  fetchReflectionForDay,
  upsertReflection,
  fetchRecentReflections
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
  });
});
