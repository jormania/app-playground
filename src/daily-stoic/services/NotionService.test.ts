import { describe, it, expect, vi } from 'vitest';
import {
  normalizeNotionId,
  validateSchema,
  fetchReflectionForDay,
  upsertReflection
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
        'Tags': { type: 'multi_select' },
        'Date': { type: 'date' }
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
      expect(errors).toContain('Missing property: "Tags"');
      expect(errors).toContain('Missing property: "Date"');
    });

    it('detects type mismatches', () => {
      const invalidProps = {
        'Name': { type: 'title' },
        'QuoteID': { type: 'select' }, // should be number
        'Reflection': { type: 'rich_text' },
        'Tags': { type: 'multi_select' },
        'Date': { type: 'date' }
      };
      const errors = validateSchema(invalidProps);
      expect(errors).toContain('Property "QuoteID" must be of type "number" (found "select")');
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
              Tags: {
                multi_select: [{ name: 'Meditations' }]
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
        tags: ['Meditations'],
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
          Tags: { multi_select: [{ name: 'Seneca' }] }
        }
      };

      const fetchImpl = vi.fn(async () => jsonResponse(mockResult));
      const res = await upsertReflection(
        'mock-token',
        '41c42bc4dfb543f49051810b3c5880fe',
        42,
        'New thoughts.',
        ['Seneca'],
        '2026-07-12',
        undefined,
        fetchImpl
      );

      expect(res).toEqual({
        id: 'new-page-id',
        text: 'New thoughts.',
        tags: ['Seneca'],
      });

      const body = JSON.parse((fetchImpl.mock.calls[0][1] as any).body);
      expect(body.method).toBe('POST');
      expect(body.path).toBe('pages');
    });

    it('updates page (PATCH) when existingPageId is provided', async () => {
      const mockResult = {
        id: 'existing-page-id',
        properties: {
          Reflection: { rich_text: [{ plain_text: 'Updated thoughts.' }] },
          Tags: { multi_select: [{ name: 'Seneca' }] }
        }
      };

      const fetchImpl = vi.fn(async () => jsonResponse(mockResult));
      const res = await upsertReflection(
        'mock-token',
        '41c42bc4dfb543f49051810b3c5880fe',
        42,
        'Updated thoughts.',
        ['Seneca'],
        '2026-07-12',
        'existing-page-id',
        fetchImpl
      );

      expect(res).toEqual({
        id: 'existing-page-id',
        text: 'Updated thoughts.',
        tags: ['Seneca'],
      });

      const body = JSON.parse((fetchImpl.mock.calls[0][1] as any).body);
      expect(body.method).toBe('PATCH');
      expect(body.path).toBe('pages/existing-page-id');
    });
  });
});
