export interface NotionReflection {
  id: string;
  text: string;
  tags: string[];
  fateInput?: string;
  acceptanceTags?: string[];
  favorite?: boolean;
}

export interface ReflectionRecord {
  date: string;
  quoteId: number;
  text?: string;
  fateInput?: string;
  acceptanceTags?: string[];
  favorite?: boolean;
}

export const RELAY_ENDPOINT = '/api/notion';

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

export function validateSchema(properties: Record<string, { type?: string }>): string[] {
  const errors: string[] = [];
  
  const expected: Record<string, string> = {
    'Name': 'title',
    'QuoteID': 'number',
    'Reflection': 'rich_text',
    'Tags': 'multi_select',
    'Date': 'date',
    'AcceptanceTags': 'multi_select',
    'FateInput': 'rich_text',
    'Favorite': 'checkbox'
  };

  for (const [name, type] of Object.entries(expected)) {
    const prop = properties[name];
    if (!prop) {
      errors.push(`Missing property: "${name}"`);
    } else if (prop.type !== type) {
      errors.push(`Property "${name}" must be of type "${type}" (found "${prop.type}")`);
    }
  }

  return errors;
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

  // Extract tags from multi_select
  const multiSelect = props.Tags?.multi_select || [];
  const tags = Array.isArray(multiSelect)
    ? multiSelect.map((o: any) => o.name || '')
    : [];

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

  return {
    id: page.id,
    text,
    tags,
    fateInput,
    acceptanceTags,
    favorite,
  };
}

export async function upsertReflection(
  token: string,
  databaseId: string,
  dayOfYear: number,
  reflection: string,
  tags: string[],
  dateStr: string,
  existingPageId?: string,
  fateInput = '',
  acceptanceTags: string[] = [],
  favorite = false,
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
    'Tags': {
      multi_select: tags.map((t) => ({ name: t })),
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

  const multiSelect = props.Tags?.multi_select || [];
  const returnTags = Array.isArray(multiSelect)
    ? multiSelect.map((o: any) => o.name || '')
    : [];

  const fateText = props.FateInput?.rich_text || [];
  const returnFateInput = Array.isArray(fateText)
    ? fateText.map((rt: any) => rt.plain_text || '').join('')
    : '';

  const acceptMultiSelect = props.AcceptanceTags?.multi_select || [];
  const returnAcceptanceTags = Array.isArray(acceptMultiSelect)
    ? acceptMultiSelect.map((o: any) => o.name || '')
    : [];

  const returnFavorite = !!props.Favorite?.checkbox;

  return {
    id: page.id,
    text,
    tags: returnTags,
    fateInput: returnFateInput,
    acceptanceTags: returnAcceptanceTags,
    favorite: returnFavorite,
  };
}

export async function fetchRecentReflections(
  token: string,
  databaseId: string,
  fetchImpl: typeof fetch = fetch
): Promise<ReflectionRecord[]> {
  const id = normalizeNotionId(databaseId);
  if (!id) throw new Error('Invalid Notion database link or ID.');

  const data = await callRelay(
    token,
    `databases/${id}/query`,
    'POST',
    {
      sorts: [
        {
          property: 'Date',
          direction: 'descending',
        },
      ],
      page_size: 100,
    },
    fetchImpl
  );

  const results = (data as { results?: unknown[] })?.results || [];
  const records: ReflectionRecord[] = [];

  for (const page of results as any[]) {
    const props = page.properties || {};
    const dateProp = props.Date?.date?.start;
    const quoteProp = props.QuoteID?.number;
    
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

    if (dateProp && typeof quoteProp === 'number') {
      records.push({
        date: dateProp,
        quoteId: quoteProp,
        text: textVal,
        fateInput: fateInputVal,
        acceptanceTags: acceptanceTagsVal,
        favorite: favoriteVal,
      });
    }
  }

  return records;
}
