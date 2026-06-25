import { describe, it, expect, vi } from 'vitest'
import {
  RELAY_ENDPOINT,
  activatePlanningOdyssey,
  activeOdysseysQuery,
  allOdysseysQuery,
  archivePageRequest,
  buildRelayInit,
  checkinsForOdysseyQuery,
  createActiveOdyssey,
  createPageRequest,
  discardPlanningDraft,
  fetchNextOdysseyInfo,
  friendlyError,
  harvestOdyssey,
  listActiveOdysseys,
  listPlanningOdyssey,
  maxOdysseyNumberQuery,
  normalizeNotionId,
  parseCheckins,
  parseMaxOdysseyNumber,
  parseOdysseyList,
  parseReflections,
  planningOdysseyQuery,
  reflectionsForOdysseyQuery,
  savePlanningDraft,
  updatePageRequest,
  upsertCheckin,
  upsertReflection,
  writeCommitment,
} from './notion'
import type { CheckinDraft } from './checkins'
import { EMPTY_REFLECTION, type ReflectionDraft } from './reflections'
import { EMPTY_SETTINGS, type Settings } from './settings'
import { emptyDraft, type CharterDraft } from './charter'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('normalizeNotionId', () => {
  it('extracts the ID from a pasted database URL, ignoring the ?v= view', () => {
    expect(
      normalizeNotionId(
        'https://app.notion.com/p/561fb186bc1142d9b9a3f56797136a1d?v=2317323f7cca44518',
      ),
    ).toBe('561fb186bc1142d9b9a3f56797136a1d')
  })

  it('handles a notion.so slug URL (ID is the trailing 32 hex)', () => {
    expect(normalizeNotionId('https://www.notion.so/me/Odysseys-561fb186bc1142d9b9a3f56797136a1d')).toBe(
      '561fb186bc1142d9b9a3f56797136a1d',
    )
  })

  it('accepts a bare hyphenated UUID and a compact ID', () => {
    expect(normalizeNotionId('48cb8b7f-f861-436b-8a46-76fb5aa57365')).toBe(
      '48cb8b7ff861436b8a4676fb5aa57365',
    )
    expect(normalizeNotionId('  561FB186BC1142D9B9A3F56797136A1D  ')).toBe(
      '561fb186bc1142d9b9a3f56797136a1d',
    )
  })

  it('returns empty string when there is no plausible ID', () => {
    expect(normalizeNotionId('not a link')).toBe('')
    expect(normalizeNotionId('')).toBe('')
  })
})

describe('buildRelayInit', () => {
  it('POSTs to the relay with the token header and an envelope body', () => {
    const init = buildRelayInit('ntn_secret', { path: 'foo/bar', method: 'POST', body: { a: 1 } })
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['x-notion-token']).toBe('ntn_secret')
    expect(headers['Content-Type']).toBe('application/json')
    // No version header — the relay's default Notion-Version applies.
    expect(headers['x-notion-version']).toBeUndefined()
    expect(JSON.parse(init.body as string)).toEqual({
      path: 'foo/bar',
      method: 'POST',
      body: { a: 1 },
    })
  })

  it('defaults the method to POST', () => {
    const init = buildRelayInit('t', { path: 'x' })
    expect(JSON.parse(init.body as string).method).toBe('POST')
  })
})

describe('activeOdysseysQuery', () => {
  it('queries databases/{id}/query filtered to Status = Active, normalizing a URL', () => {
    const req = activeOdysseysQuery('https://app.notion.com/p/561fb186bc1142d9b9a3f56797136a1d?v=abc')
    expect(req.path).toBe('databases/561fb186bc1142d9b9a3f56797136a1d/query')
    expect(req.method).toBe('POST')
    expect(req.body).toMatchObject({
      filter: { property: 'Status', select: { equals: 'Active' } },
    })
  })

  it('throws when no database ID can be parsed', () => {
    expect(() => activeOdysseysQuery('not a link')).toThrow(/database link or ID/i)
  })
})

describe('allOdysseysQuery', () => {
  it('queries all rows, newest first, with no status filter', () => {
    const req = allOdysseysQuery('561fb186bc1142d9b9a3f56797136a1d')
    expect(req.path).toBe('databases/561fb186bc1142d9b9a3f56797136a1d/query')
    expect(req.body).toMatchObject({ sorts: [{ property: 'Odyssey Number', direction: 'descending' }] })
    expect((req.body as { filter?: unknown }).filter).toBeUndefined()
  })
})

describe('parseOdysseyList', () => {
  it('maps results to full details (id, title, charter fields)', () => {
    const json = {
      results: [
        {
          id: 'page-1',
          properties: {
            Name: { title: [{ plain_text: 'Odyssey I — ' }, { plain_text: 'movement' }] },
            'Odyssey Number': { number: 1 },
            Status: { select: { name: 'Active' } },
            'Start Date': { date: { start: '2026-07-06' } },
            'End Date': { date: { start: '2026-08-16' } },
            'Tiny Version': { rich_text: [{ plain_text: 'walk to the corner' }] },
          },
        },
      ],
    }
    expect(parseOdysseyList(json)).toMatchObject([
      {
        id: 'page-1',
        title: 'Odyssey I — movement',
        number: 1,
        status: 'Active',
        startDate: '2026-07-06',
        endDate: '2026-08-16',
        tinyVersion: 'walk to the corner',
      },
    ])
  })

  it('returns [] for an empty or shapeless response', () => {
    expect(parseOdysseyList({ results: [] })).toEqual([])
    expect(parseOdysseyList({})).toEqual([])
    expect(parseOdysseyList(null)).toEqual([])
  })

  it('falls back to a placeholder title when Name is missing', () => {
    expect(parseOdysseyList({ results: [{ id: 'p2' }] })).toMatchObject([
      { id: 'p2', title: '(untitled Odyssey)', number: null },
    ])
  })
})

describe('friendlyError', () => {
  it('explains common statuses without scary wording', () => {
    expect(friendlyError(401, {})).toMatch(/token/i)
    expect(friendlyError(404, {})).toMatch(/database/i)
    expect(friendlyError(400, { message: 'bad filter' })).toMatch(/bad filter/)
    expect(friendlyError(503, {})).toMatch(/503/)
  })
})

describe('listActiveOdysseys', () => {
  const settings = { token: 't', dsOdysseys: '561fb186bc1142d9b9a3f56797136a1d' }

  it('calls the relay and returns the parsed list on success', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [{ id: 'p1', properties: { Name: { title: [{ plain_text: 'A' }] } } }],
        }),
        { status: 200 },
      ),
    )
    const out = await listActiveOdysseys(settings, fetchMock as unknown as typeof fetch)
    expect(fetchMock).toHaveBeenCalledWith(RELAY_ENDPOINT, expect.objectContaining({ method: 'POST' }))
    expect(out).toMatchObject([{ id: 'p1', title: 'A' }])
  })

  it('throws a friendly error on a non-ok response', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 401 }))
    await expect(
      listActiveOdysseys(settings, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/token/i)
  })

  it('explains a missing relay when the response is not JSON (local dev server)', async () => {
    // Under `vite dev`, /api/notion 404s with an HTML page, not JSON.
    const fetchMock = vi.fn(
      async () => new Response('<!doctype html><title>404</title>', { status: 404 }),
    )
    await expect(
      listActiveOdysseys(settings, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/relay|vercel/i)
  })

  it('refuses to call out without a token or a database link', async () => {
    const fetchMock = vi.fn()
    await expect(
      listActiveOdysseys({ token: '', dsOdysseys: 'ds' }, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/token/i)
    await expect(
      listActiveOdysseys({ token: 't', dsOdysseys: '' }, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/database link/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('createPageRequest', () => {
  it('builds a pages POST with parent.database_id (normalized) + properties', () => {
    const req = createPageRequest('https://app.notion.com/p/561fb186bc1142d9b9a3f56797136a1d?v=x', {
      Name: { title: [] },
    })
    expect(req.path).toBe('pages')
    expect(req.method).toBe('POST')
    expect(req.body).toMatchObject({
      parent: { database_id: '561fb186bc1142d9b9a3f56797136a1d' },
      properties: { Name: { title: [] } },
    })
  })
})

describe('maxOdysseyNumber', () => {
  it('queries sorted desc, page_size 1, filtered to numbered rows (excludes drafts)', () => {
    const req = maxOdysseyNumberQuery('561fb186bc1142d9b9a3f56797136a1d')
    expect(req.body).toMatchObject({
      filter: { property: 'Odyssey Number', number: { is_not_empty: true } },
      sorts: [{ property: 'Odyssey Number', direction: 'descending' }],
      page_size: 1,
    })
  })

  it('parses the top number, or null when none/blank', () => {
    expect(parseMaxOdysseyNumber({ results: [{ properties: { 'Odyssey Number': { number: 3 } } }] })).toBe(3)
    expect(parseMaxOdysseyNumber({ results: [] })).toBeNull()
    expect(parseMaxOdysseyNumber({ results: [{ properties: {} }] })).toBeNull()
  })
})

describe('createActiveOdyssey', () => {
  const settings: Settings = {
    ...EMPTY_SETTINGS,
    token: 't',
    dsOdysseys: '561fb186bc1142d9b9a3f56797136a1d',
    buddyName: 'Sam',
    buddyEmail: 'sam@example.com',
  }
  const draft: CharterDraft = {
    ...emptyDraft(new Date('2026-07-06')),
    behaviour: 'morning movement',
    outcomePicture: 'steadier mind',
    identity: 'I am someone who moves',
    tinyVersion: 'walk to the corner',
    anchor: 'after my first coffee',
    ifThen: 'if it rains, hallway',
    dailySuccess: 'shoes on, outside',
    whyValue: 'a body in motion',
    confirmedShrink: true,
  }

  it('refuses when an Active Odyssey already exists (Law I)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [{ id: 'x', properties: {} }] }))
    await expect(
      createActiveOdyssey(settings, draft, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/already have an active/i)
    expect(fetchMock).toHaveBeenCalledTimes(1) // stopped at the active-check
  })

  it('numbers past the max and POSTs the new page to pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] })) // active check → none
      .mockResolvedValueOnce(jsonResponse({ results: [{ properties: { 'Odyssey Number': { number: 2 } } }] })) // max → 2
      .mockResolvedValueOnce(
        jsonResponse({ id: 'new-id', properties: { Name: { title: [{ plain_text: 'Odyssey III — morning movement' }] } } }),
      )
    const out = await createActiveOdyssey(settings, draft, fetchMock as unknown as typeof fetch)
    expect(out).toMatchObject({ id: 'new-id', title: 'Odyssey III — morning movement' })

    const createCall = fetchMock.mock.calls[2]
    const body = JSON.parse((createCall[1] as RequestInit).body as string)
    expect(body.path).toBe('pages')
    expect(body.body.properties['Odyssey Number'].number).toBe(3)
    expect(body.body.properties['Status'].select.name).toBe('Active')
  })
})

describe('Planning (draft) Odysseys', () => {
  const settings: Settings = {
    ...EMPTY_SETTINGS,
    token: 't',
    dsOdysseys: '561fb186bc1142d9b9a3f56797136a1d',
    buddyName: 'Sam',
    buddyEmail: 'sam@example.com',
  }
  const draft: CharterDraft = {
    ...emptyDraft(new Date('2026-07-06')),
    behaviour: 'morning movement',
    identity: 'I am someone who moves',
    tinyVersion: 'walk to the corner',
    anchor: 'after my first coffee',
    ifThen: 'if it rains, hallway',
    dailySuccess: 'shoes on, outside',
    whyValue: 'a body in motion',
    confirmedShrink: true,
  }

  it('planningOdysseyQuery filters Status = Planning', () => {
    const req = planningOdysseyQuery('561fb186bc1142d9b9a3f56797136a1d')
    expect(req.path).toBe('databases/561fb186bc1142d9b9a3f56797136a1d/query')
    expect(req.body).toMatchObject({
      filter: { property: 'Status', select: { equals: 'Planning' } },
      page_size: 1,
    })
  })

  it('archivePageRequest PATCHes archived:true', () => {
    expect(archivePageRequest('page-7')).toMatchObject({
      path: 'pages/page-7',
      method: 'PATCH',
      body: { archived: true },
    })
  })

  it('listPlanningOdyssey returns the draft, or null when there is none', async () => {
    const has = vi.fn(async (..._a: unknown[]) =>
      jsonResponse({ results: [{ id: 'd1', properties: { Status: { select: { name: 'Planning' } } } }] }),
    )
    expect(await listPlanningOdyssey(settings, has as unknown as typeof fetch)).toMatchObject({ id: 'd1', status: 'Planning' })
    const none = vi.fn(async (..._a: unknown[]) => jsonResponse({ results: [] }))
    expect(await listPlanningOdyssey(settings, none as unknown as typeof fetch)).toBeNull()
  })

  it('savePlanningDraft POSTs a Planning page when there is no existing draft', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'new', properties: {} }))
    await savePlanningDraft(settings, draft, undefined, fetchMock as unknown as typeof fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages')
    expect(body.method).toBe('POST')
    expect(body.body.properties['Status'].select.name).toBe('Planning')
    expect(body.body.properties['Odyssey Number']).toBeUndefined()
  })

  it('savePlanningDraft PATCHes the existing draft when given its id', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'd1', properties: {} }))
    await savePlanningDraft(settings, draft, 'd1', fetchMock as unknown as typeof fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages/d1')
    expect(body.method).toBe('PATCH')
  })

  it('activatePlanningOdyssey refuses when an Active Odyssey exists (Law I)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [{ id: 'x', properties: {} }] }))
    await expect(
      activatePlanningOdyssey(settings, 'd1', draft, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/already have an active/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('activatePlanningOdyssey numbers past the max and PATCHes the draft to Active', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] })) // active check → none
      .mockResolvedValueOnce(jsonResponse({ results: [{ properties: { 'Odyssey Number': { number: 2 } } }] })) // max → 2
      .mockResolvedValueOnce(
        jsonResponse({ id: 'd1', properties: { Name: { title: [{ plain_text: 'Odyssey III — morning movement' }] }, Status: { select: { name: 'Active' } } } }),
      )
    const out = await activatePlanningOdyssey(settings, 'd1', draft, fetchMock as unknown as typeof fetch)
    expect(out).toMatchObject({ id: 'd1', status: 'Active' })

    const patch = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)
    expect(patch.path).toBe('pages/d1')
    expect(patch.method).toBe('PATCH')
    expect(patch.body.properties['Odyssey Number'].number).toBe(3)
    expect(patch.body.properties['Status'].select.name).toBe('Active')
  })

  it('discardPlanningDraft archives the row', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'd1', archived: true }))
    await discardPlanningDraft({ token: 't' }, 'd1', fetchMock as unknown as typeof fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages/d1')
    expect(body.method).toBe('PATCH')
    expect(body.body.archived).toBe(true)
  })
})

describe('writeCommitment', () => {
  it('PATCHes the Odyssey with a Commitment rich_text (and clears with an empty array)', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'o1', properties: {} }))
    await writeCommitment({ token: 't' }, 'o1', 'donate £20 and tell my buddy', fetchMock as unknown as typeof fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages/o1')
    expect(body.method).toBe('PATCH')
    expect(body.body.properties.Commitment.rich_text[0].text.content).toBe('donate £20 and tell my buddy')

    const clearMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'o1', properties: {} }))
    await writeCommitment({ token: 't' }, 'o1', '   ', clearMock as unknown as typeof fetch)
    expect(JSON.parse((clearMock.mock.calls[0][1] as RequestInit).body as string).body.properties.Commitment.rich_text).toEqual([])
  })

  it('maps a missing-column 400 to an "add the column" message', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) =>
      jsonResponse({ message: 'Commitment is not a property that exists' }, 400),
    )
    await expect(
      writeCommitment({ token: 't' }, 'o1', 'something', fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/Commitment.*property|property.*Odysseys/i)
  })
})

describe('check-ins', () => {
  it('updatePageRequest is a PATCH to the page', () => {
    const req = updatePageRequest('page-9', { Done: { checkbox: true } })
    expect(req).toMatchObject({ path: 'pages/page-9', method: 'PATCH', body: { properties: { Done: { checkbox: true } } } })
  })

  it('checkinsForOdysseyQuery filters by relation + sorts by Date', () => {
    const req = checkinsForOdysseyQuery('561fb186bc1142d9b9a3f56797136a1d', 'odyssey-1')
    expect(req.path).toBe('databases/561fb186bc1142d9b9a3f56797136a1d/query')
    expect(req.body).toMatchObject({
      filter: { property: 'Odyssey', relation: { contains: 'odyssey-1' } },
      sorts: [{ property: 'Date', direction: 'ascending' }],
    })
  })

  it('parseCheckins reads the row fields incl. checkboxes', () => {
    const json = {
      results: [
        {
          id: 'c1',
          properties: {
            Date: { date: { start: '2026-07-12' } },
            'Day Index': { number: 7 },
            Done: { checkbox: true },
            'One Line': { rich_text: [{ plain_text: 'walked' }] },
            'Sent To Buddy': { checkbox: false },
          },
        },
      ],
    }
    expect(parseCheckins(json)).toEqual([
      { id: 'c1', date: '2026-07-12', dayIndex: 7, done: true, oneLine: 'walked', friction: '', sentToBuddy: false },
    ])
  })

  const settings = { token: 't', dsCheckins: '707f44ae041744eea09bb05e7ec8854e' }
  const draft: CheckinDraft = { done: true, oneLine: 'walked', friction: '', sentToBuddy: true }
  const base = { odysseyId: 'odyssey-1', odysseyNumber: 1, dateISO: '2026-07-12', dayIndex: 7, draft }

  it('upsertCheckin POSTs to pages when there is no existing row', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'new', properties: {} }))
    await upsertCheckin(settings, base, fetchMock as unknown as typeof fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages')
    expect(body.method).toBe('POST')
    expect(body.body.properties['Day Index'].number).toBe(7)
  })

  it('upsertCheckin PATCHes the existing row when given its id (idempotent per date)', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'c1', properties: {} }))
    await upsertCheckin(settings, { ...base, existingId: 'c1' }, fetchMock as unknown as typeof fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages/c1')
    expect(body.method).toBe('PATCH')
  })
})

describe('weekly reflections', () => {
  it('reflectionsForOdysseyQuery filters by relation + sorts by Week Index', () => {
    const req = reflectionsForOdysseyQuery('3a5f174dea9148aeb7a12809ffa289c7', 'odyssey-1')
    expect(req.path).toBe('databases/3a5f174dea9148aeb7a12809ffa289c7/query')
    expect(req.body).toMatchObject({
      filter: { property: 'Odyssey', relation: { contains: 'odyssey-1' } },
      sorts: [{ property: 'Week Index', direction: 'ascending' }],
    })
  })

  it('parseReflections reads numbers, select, and checkbox', () => {
    const json = {
      results: [
        {
          id: 'r1',
          properties: {
            'Week Index': { number: 3 },
            'Days Done': { number: 5 },
            Fit: { select: { name: 'About right' } },
            Temperature: { number: 6 },
            'Buddy Reflected': { checkbox: true },
          },
        },
      ],
    }
    expect(parseReflections(json)).toEqual([
      { id: 'r1', weekIndex: 3, date: '', daysDone: 5, breakPoints: '', fit: 'About right', oneAdjustment: '', riskPlan: '', temperature: 6, buddyReflected: true },
    ])
  })

  const settings = { token: 't', dsReflections: '3a5f174dea9148aeb7a12809ffa289c7' }
  const draft: ReflectionDraft = { ...EMPTY_REFLECTION, daysDone: 5, fit: 'About right', temperature: 6 }
  const base = { odysseyId: 'odyssey-1', odysseyNumber: 1, weekIndex: 3, dateISO: '2026-07-27', draft }

  it('upsertReflection POSTs to pages when there is no existing row', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'new', properties: {} }))
    await upsertReflection(settings, base, fetchMock as unknown as typeof fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages')
    expect(body.method).toBe('POST')
    expect(body.body.properties['Week Index'].number).toBe(3)
  })

  it('upsertReflection PATCHes the existing week when given its id', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ id: 'r1', properties: {} }))
    await upsertReflection(settings, { ...base, existingId: 'r1' }, fetchMock as unknown as typeof fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages/r1')
    expect(body.method).toBe('PATCH')
  })
})

describe('fetchNextOdysseyInfo', () => {
  const settings = { token: 't', dsOdysseys: '561fb186bc1142d9b9a3f56797136a1d' }

  it('reports prior history and the next number', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) =>
      jsonResponse({ results: [{ properties: { 'Odyssey Number': { number: 2 } } }] }),
    )
    expect(await fetchNextOdysseyInfo(settings, fetchMock as unknown as typeof fetch)).toEqual({
      hasPrior: true,
      nextNumber: 3,
    })
  })

  it('returns first-run defaults when no Odyssey exists', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => jsonResponse({ results: [] }))
    expect(await fetchNextOdysseyInfo(settings, fetchMock as unknown as typeof fetch)).toEqual({
      hasPrior: false,
      nextNumber: 1,
    })
  })

  it('short-circuits to first-run when unconfigured (no call)', async () => {
    const fetchMock = vi.fn()
    expect(await fetchNextOdysseyInfo({ token: '', dsOdysseys: '' }, fetchMock as unknown as typeof fetch)).toEqual({
      hasPrior: false,
      nextNumber: 1,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('harvestOdyssey', () => {
  it('PATCHes the Odyssey with Outcome + mapped Status + Notes', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) =>
      jsonResponse({ id: 'odyssey-1', properties: { Name: { title: [{ plain_text: 'Odyssey I' }] }, Status: { select: { name: 'Maintenance' } } } }),
    )
    const out = await harvestOdyssey(
      { token: 't' },
      { odysseyId: 'odyssey-1', outcome: 'Keep', verdict: 'automatic now' },
      fetchMock as unknown as typeof fetch,
    )
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.path).toBe('pages/odyssey-1')
    expect(body.method).toBe('PATCH')
    expect(body.body.properties['Outcome'].select.name).toBe('Keep')
    expect(body.body.properties['Status'].select.name).toBe('Maintenance')
    expect(out).toMatchObject({ id: 'odyssey-1', status: 'Maintenance' })
  })
})
