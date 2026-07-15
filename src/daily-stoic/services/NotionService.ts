import { getCycleInfo } from '../utils/date';

export interface NotionReflection {
  id: string;
  text: string;
  fateInput?: string;
  acceptanceTags?: string[];
  favorite?: boolean;
  mood?: string;
  morningIntentions?: string;
  passions?: string[];
  createdTime?: string;
  dichotomy?: string;
  virtue?: string;
}

export interface ReflectionRecord {
  id?: string;
  date: string;
  quoteId: number;
  text?: string;
  fateInput?: string;
  acceptanceTags?: string[];
  favorite?: boolean;
  mood?: string;
  morningIntentions?: string;
  passions?: string[];
  createdTime?: string;
  dichotomy?: string;
  virtue?: string;
}

export const RELAY_ENDPOINT = typeof window !== 'undefined' ? '/api/notion' : 'http://localhost/api/notion';

export function normalizeNotionId(input: string): string {
  const withoutQuery = (input || '').trim().split(/[?#]/)[0];
  
  // Try matching hyphenated UUID first (e.g. 41c42bc4-dfb5-43f4-9051-810b3c5880fe)
  const hyphenated = withoutQuery.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (hyphenated) {
    return hyphenated[0].replace(/-/g, '').toLowerCase();
  }

  // Parse the last segment of the path
  const parts = withoutQuery.split('/');
  const lastPart = parts[parts.length - 1] || '';

  // Match a trailing 32-character hex sequence
  const match = lastPart.match(/[0-9a-fA-F]{32}$/);
  if (match) {
    return match[0].toLowerCase();
  }

  // Fallback to removing all hyphens from the last segment and searching for 32 hex chars
  const compact = lastPart.replace(/-/g, '');
  const runs = compact.match(/[0-9a-fA-F]{32}/g);
  return runs ? runs[runs.length - 1].toLowerCase() : '';
}

export function buildRelayInit(token: string, path: string, method: string, body?: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-notion-token': token.trim(),
    },
    body: JSON.stringify({
      path,
      method,
      body,
    }),
  };
}

async function callRelay(
  token: string,
  path: string,
  method: string,
  body?: unknown,
  fetchImpl: typeof fetch = fetch
): Promise<unknown> {
  if (!token.trim()) throw new Error('Notion token is missing.');
  
  const res = await fetchImpl(RELAY_ENDPOINT, buildRelayInit(token, path, method, body));
  
  let data: any = {};
  let parsed = false;
  try {
    data = await res.json();
    parsed = true;
  } catch {
    /* non-JSON response */
  }

  if (!parsed) {
    throw new Error(
      'Could not reach the Notion relay (/api/notion). If you are on a local dev server, ' +
      'please ensure the dev serverless functions are configured correctly.'
    );
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `Notion request failed (${res.status})`;
    if (res.status === 401) {
      throw new Error('Notion token was rejected. Please check it in Settings.');
    }
    if (res.status === 404) {
      throw new Error('Notion database not found. Ensure the integration has access to the database.');
    }
    throw new Error(message);
  }

  return data;
}

const REQUIRED_SCHEMA: Record<string, string> = {
  'Name': 'title',
  'QuoteID': 'number',
  'Reflection': 'rich_text',
  'Date': 'date',
  'AcceptanceTags': 'multi_select',
  'FateInput': 'rich_text',
  'Favorite': 'checkbox'
};

// The single source of truth for every optional (auto-upgradeable) column —
// validateSchema, upgradeDatabaseSchema, and getMissingOptionalColumns all
// derive from this one map, so adding a new optional property here is
// enough; a name added to only one of those three previously caused a real
// bug (Cycle/WeekOfCycle were written by upsertReflection and checked by
// validateSchema, but missing from the App.tsx auto-upgrade trigger, so an
// older database's save silently failed with "Cycle is not a property that
// exists" until the user happened to hit a schema-error path some other way).
const OPTIONAL_SCHEMA: Record<string, string> = {
  'Mood': 'select',
  'MorningIntentions': 'rich_text',
  'Passions': 'multi_select',
  'Dichotomy': 'rich_text',
  'Virtue': 'rich_text',
  'Cycle': 'number',
  'WeekOfCycle': 'number'
};

export function validateSchema(properties: Record<string, { type?: string }>): string[] {
  const errors: string[] = [];

  for (const [name, type] of Object.entries(REQUIRED_SCHEMA)) {
    const prop = properties[name];
    if (!prop) {
      errors.push(`Missing property: "${name}"`);
    } else if (prop.type !== type) {
      errors.push(`Property "${name}" must be of type "${type}" (found "${prop.type}")`);
    }
  }

  for (const [name, type] of Object.entries(OPTIONAL_SCHEMA)) {
    const prop = properties[name];
    if (prop && prop.type !== type) {
      errors.push(`Property "${name}" must be of type "${type}" (found "${prop.type}")`);
    }
  }

  return errors;
}

// Which optional columns a database is missing (regardless of type
// mismatches, which validateSchema already reports separately) — the signal
// App.tsx uses to decide whether to call upgradeDatabaseSchema.
export function getMissingOptionalColumns(properties: Record<string, { type?: string }>): string[] {
  return Object.keys(OPTIONAL_SCHEMA).filter((name) => !properties[name]);
}

export async function upgradeDatabaseSchema(
  token: string,
  databaseId: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const id = normalizeNotionId(databaseId);
  if (!id) throw new Error('Invalid Notion database link or ID.');

  const body = {
    properties: Object.fromEntries(
      Object.entries(OPTIONAL_SCHEMA).map(([name, type]) => [name, { [type]: {} }])
    ),
  };

  await callRelay(token, `databases/${id}`, 'PATCH', body, fetchImpl);
}

export async function fetchDatabaseProperties(
  token: string,
  databaseId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Record<string, { type?: string }>> {
  const id = normalizeNotionId(databaseId);
  if (!id) throw new Error('Invalid Notion database link or ID.');

  const data = await callRelay(token, `databases/${id}`, 'GET', undefined, fetchImpl);
  return ((data as { properties?: Record<string, { type?: string }> })?.properties) ?? {};
}

export async function probeConnection(
  token: string,
  databaseId: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const id = normalizeNotionId(databaseId);
  if (!id) throw new Error('Invalid Notion database link or ID.');

  await callRelay(token, `databases/${id}/query`, 'POST', { page_size: 1 }, fetchImpl);
}

export async function fetchReflectionForDay(
  token: string,
  databaseId: string,
  dayOfYear: number,
  fetchImpl: typeof fetch = fetch
): Promise<NotionReflection | null> {
  const id = normalizeNotionId(databaseId);
  if (!id) throw new Error('Invalid Notion database link or ID.');

  const data = await callRelay(
    token,
    `databases/${id}/query`,
    'POST',
    {
      filter: {
        property: 'QuoteID',
        number: {
          equals: dayOfYear,
        },
      },
      page_size: 1,
    },
    fetchImpl
  );

  const results = (data as { results?: unknown[] })?.results;
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const page: any = results[0];
  const props = page.properties || {};

  // Extract reflection text from rich_text
  const richText = props.Reflection?.rich_text || [];
  const text = Array.isArray(richText)
    ? richText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  // Extract FateInput text from rich_text
  const fateText = props.FateInput?.rich_text || [];
  const fateInput = Array.isArray(fateText)
    ? fateText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  // Extract AcceptanceTags from multi_select
  const acceptMultiSelect = props.AcceptanceTags?.multi_select || [];
  const acceptanceTags = Array.isArray(acceptMultiSelect)
    ? acceptMultiSelect.map((o: any) => o.name || '')
    : [];

  // Extract Favorite checkbox
  const favorite = !!props.Favorite?.checkbox;

  // Extract Mood select
  const mood = props.Mood?.select?.name || '';

  // Extract MorningIntentions rich_text
  const intentText = props.MorningIntentions?.rich_text || [];
  const morningIntentions = Array.isArray(intentText)
    ? intentText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  // Extract Passions multi_select
  const passMultiSelect = props.Passions?.multi_select || [];
  const passions = Array.isArray(passMultiSelect)
    ? passMultiSelect.map((o: any) => o.name || '')
    : [];

  // Extract Dichotomy rich_text
  const dichotomyText = props.Dichotomy?.rich_text || [];
  const dichotomy = Array.isArray(dichotomyText)
    ? dichotomyText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  // Extract Virtue rich_text
  const virtueText = props.Virtue?.rich_text || [];
  const virtue = Array.isArray(virtueText)
    ? virtueText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const createdTime = page.created_time || '';

  return {
    id: page.id,
    text,
    fateInput,
    acceptanceTags,
    favorite,
    mood,
    morningIntentions,
    passions,
    createdTime,
    dichotomy,
    virtue,
  };
}

export async function upsertReflection(
  token: string,
  databaseId: string,
  dayOfYear: number,
  reflection: string,
  dateStr: string,
  existingPageId?: string,
  fateInput = '',
  acceptanceTags: string[] = [],
  favorite = false,
  mood = '',
  morningIntentions = '',
  passions: string[] = [],
  dichotomy = '',
  virtue = '',
  fetchImpl: typeof fetch = fetch
): Promise<NotionReflection> {
  const id = normalizeNotionId(databaseId);
  if (!id) throw new Error('Invalid Notion database link or ID.');

  const properties: Record<string, unknown> = {
    'Name': {
      title: [
        {
          text: {
            content: `Day ${dayOfYear} Reflection`,
          },
        },
      ],
    },
    'QuoteID': {
      number: dayOfYear,
    },
    'Reflection': {
      rich_text: [
        {
          text: {
            content: reflection,
          },
        },
      ],
    },
    'Date': {
      date: {
        start: dateStr,
      },
    },
    'FateInput': {
      rich_text: [
        {
          text: {
            content: fateInput,
          },
        },
      ],
    },
    'AcceptanceTags': {
      multi_select: acceptanceTags.map((t) => ({ name: t })),
    },
    'Favorite': {
      checkbox: favorite,
    },
  };

  if (mood) {
    properties['Mood'] = { select: { name: mood } };
  } else {
    properties['Mood'] = { select: null };
  }

  properties['MorningIntentions'] = {
    rich_text: [
      { text: { content: morningIntentions } }
    ]
  };

  properties['Passions'] = {
    multi_select: passions.map((p) => ({ name: p })),
  };

  // Chunk dichotomy into <=2000-char blocks to respect Notion's rich_text limit
  const CHUNK = 2000;
  const dichotomyBlocks: { text: { content: string } }[] = [];
  for (let i = 0; i < dichotomy.length || dichotomyBlocks.length === 0; i += CHUNK) {
    dichotomyBlocks.push({ text: { content: dichotomy.slice(i, i + CHUNK) || '' } });
    if (!dichotomy) break;
  }
  properties['Dichotomy'] = { rich_text: dichotomyBlocks };

  properties['Virtue'] = {
    rich_text: [
      { text: { content: virtue.slice(0, CHUNK) } }
    ]
  };

  // Cycle/WeekOfCycle are fully derived from dayOfYear (an unbounded day count
  // since cycleStartDate — see utils/date.ts's getCycleInfo) — written here
  // purely so the cycle a day belonged to is visible/filterable in Notion
  // itself. The app never reads these back; it always recomputes from
  // dayOfYear + cycleStartDate directly, so there's no staleness risk.
  const cycleInfo = getCycleInfo(dayOfYear);
  properties['Cycle'] = { number: cycleInfo.cycle };
  properties['WeekOfCycle'] = { number: cycleInfo.week };

  let page: any;
  if (existingPageId) {
    page = await callRelay(
      token,
      `pages/${existingPageId}`,
      'PATCH',
      { properties },
      fetchImpl
    );
  } else {
    page = await callRelay(
      token,
      'pages',
      'POST',
      {
        parent: { database_id: id },
        properties,
      },
      fetchImpl
    );
  }

  const props = page.properties || {};
  
  const richText = props.Reflection?.rich_text || [];
  const text = Array.isArray(richText)
    ? richText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const fateText = props.FateInput?.rich_text || [];
  const returnFateInput = Array.isArray(fateText)
    ? fateText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const acceptMultiSelect = props.AcceptanceTags?.multi_select || [];
  const returnAcceptanceTags = Array.isArray(acceptMultiSelect)
    ? acceptMultiSelect.map((o: any) => o.name || '')
    : [];

  const returnFavorite = !!props.Favorite?.checkbox;

  const returnMood = props.Mood?.select?.name || '';

  const intentText = props.MorningIntentions?.rich_text || [];
  const returnMorningIntentions = Array.isArray(intentText)
    ? intentText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const passMultiSelect = props.Passions?.multi_select || [];
  const returnPassions = Array.isArray(passMultiSelect)
    ? passMultiSelect.map((o: any) => o.name || '')
    : [];

  const dichotomyText = props.Dichotomy?.rich_text || [];
  const returnDichotomy = Array.isArray(dichotomyText)
    ? dichotomyText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const virtueText = props.Virtue?.rich_text || [];
  const returnVirtue = Array.isArray(virtueText)
    ? virtueText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const returnCreatedTime = page.created_time || '';

  return {
    id: page.id,
    text,
    fateInput: returnFateInput,
    acceptanceTags: returnAcceptanceTags,
    favorite: returnFavorite,
    mood: returnMood,
    morningIntentions: returnMorningIntentions,
    passions: returnPassions,
    createdTime: returnCreatedTime,
    dichotomy: returnDichotomy,
    virtue: returnVirtue,
  };
}

function parsePageToRecord(page: any): ReflectionRecord | null {
  const props = page.properties || {};
  const dateProp = props.Date?.date?.start;
  const quoteProp = props.QuoteID?.number;

  if (!dateProp || typeof quoteProp !== 'number') return null;

  const richText = props.Reflection?.rich_text || [];
  const textVal = Array.isArray(richText)
    ? richText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const fateText = props.FateInput?.rich_text || [];
  const fateInputVal = Array.isArray(fateText)
    ? fateText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const acceptMultiSelect = props.AcceptanceTags?.multi_select || [];
  const acceptanceTagsVal = Array.isArray(acceptMultiSelect)
    ? acceptMultiSelect.map((o: any) => o.name || '')
    : [];

  const favoriteVal = !!props.Favorite?.checkbox;

  const moodVal = props.Mood?.select?.name || '';

  const intentText = props.MorningIntentions?.rich_text || [];
  const morningIntentionsVal = Array.isArray(intentText)
    ? intentText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const passMultiSelect = props.Passions?.multi_select || [];
  const passionsVal = Array.isArray(passMultiSelect)
    ? passMultiSelect.map((o: any) => o.name || '')
    : [];

  const dichotomyText = props.Dichotomy?.rich_text || [];
  const dichotomyVal = Array.isArray(dichotomyText)
    ? dichotomyText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const virtueText = props.Virtue?.rich_text || [];
  const virtueVal = Array.isArray(virtueText)
    ? virtueText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const createdTimeVal = page.created_time || '';

  return {
    id: page.id,
    date: dateProp,
    quoteId: quoteProp,
    text: textVal,
    fateInput: fateInputVal,
    acceptanceTags: acceptanceTagsVal,
    favorite: favoriteVal,
    mood: moodVal,
    morningIntentions: morningIntentionsVal,
    passions: passionsVal,
    createdTime: createdTimeVal,
    dichotomy: dichotomyVal,
    virtue: virtueVal,
  };
}

// Queries pages sorted newest-first. maxPages caps how many page_size-sized
// requests to make (1 = a single page, matching the old fixed page_size:100
// behavior); pass null to follow Notion's has_more/next_cursor until the
// entire database has been retrieved.
async function fetchReflectionPages(
  token: string,
  databaseId: string,
  pageSize: number,
  maxPages: number | null,
  fetchImpl: typeof fetch
): Promise<any[]> {
  const id = normalizeNotionId(databaseId);
  if (!id) throw new Error('Invalid Notion database link or ID.');

  const allResults: any[] = [];
  let cursor: string | undefined;
  let pagesFetched = 0;

  do {
    const body: Record<string, unknown> = {
      sorts: [{ property: 'Date', direction: 'descending' }],
      page_size: pageSize,
    };
    if (cursor) body.start_cursor = cursor;

    const data: any = await callRelay(token, `databases/${id}/query`, 'POST', body, fetchImpl);
    allResults.push(...(data?.results || []));
    pagesFetched++;

    cursor = data?.has_more ? data?.next_cursor ?? undefined : undefined;
  } while (cursor && (maxPages === null || pagesFetched < maxPages));

  return allResults;
}

export async function fetchRecentReflections(
  token: string,
  databaseId: string,
  fetchImpl: typeof fetch = fetch
): Promise<ReflectionRecord[]> {
  const pages = await fetchReflectionPages(token, databaseId, 100, 1, fetchImpl);
  return pages.map(parsePageToRecord).filter((r): r is ReflectionRecord => r !== null);
}

// Follows pagination to retrieve the complete history — for the Digest
// dashboard, which is meant to be a genuine archive rather than a windowed
// view like the other dashboards (which stay on fetchRecentReflections'
// single-page fetch; they don't need full history since they already offer
// their own 30d/90d/365d/All filters over whatever they do have).
export async function fetchAllReflections(
  token: string,
  databaseId: string,
  fetchImpl: typeof fetch = fetch
): Promise<ReflectionRecord[]> {
  const pages = await fetchReflectionPages(token, databaseId, 100, null, fetchImpl);
  return pages.map(parsePageToRecord).filter((r): r is ReflectionRecord => r !== null);
}

export async function clearDatabaseEntries(
  token: string,
  databaseId: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const id = normalizeNotionId(databaseId);
  if (!id) throw new Error('Invalid Notion database link or ID.');

  const data = await callRelay(
    token,
    `databases/${id}/query`,
    'POST',
    { page_size: 100 },
    fetchImpl
  );

  const results = (data as { results?: unknown[] })?.results || [];
  for (const page of results as any[]) {
    if (page?.id) {
      await callRelay(token, `pages/${page.id}`, 'PATCH', { archived: true }, fetchImpl);
    }
  }
}

