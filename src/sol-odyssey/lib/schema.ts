// The Notion schema the app reads/writes — the single source of truth for setup validation. Each
// entry maps a property NAME to its Notion property TYPE, exactly as the build*Properties functions
// produce them. "Test connection" checks a user's databases against these and reports precisely what
// to add, so a misnamed/missing column is caught before Day 1 (not as a cryptic write error later).

export type DbKey = 'odysseys' | 'checkins' | 'reflections'

export const DB_LABEL: Record<DbKey, string> = {
  odysseys: 'Odysseys',
  checkins: 'Check-ins',
  reflections: 'Weekly Reflections',
}

export const EXPECTED_SCHEMA: Record<DbKey, Record<string, string>> = {
  odysseys: {
    Name: 'title',
    'Odyssey Number': 'number',
    Status: 'select',
    'Start Date': 'date',
    'End Date': 'date',
    Behaviour: 'rich_text',
    'Identity Statement': 'rich_text',
    'Tiny Version': 'rich_text',
    Anchor: 'rich_text',
    'If-Then': 'rich_text',
    'Outcome Picture': 'rich_text',
    Pairing: 'rich_text',
    'Daily Success': 'rich_text',
    'Why / Value': 'rich_text',
    'Buddy Name': 'rich_text',
    'Buddy Channel': 'rich_text',
    'Daily Reminder Time': 'rich_text',
    'Weekly Call Slot': 'rich_text',
    Commitment: 'rich_text',
    Outcome: 'select',
    Notes: 'rich_text',
  },
  checkins: {
    Name: 'title',
    Odyssey: 'relation',
    Date: 'date',
    'Day Index': 'number',
    'Week Index': 'number',
    Done: 'checkbox',
    'One Line': 'rich_text',
    Friction: 'rich_text',
    'Sent To Buddy': 'checkbox',
    'Logged Late': 'checkbox',
  },
  reflections: {
    Name: 'title',
    Odyssey: 'relation',
    'Week Index': 'number',
    Date: 'date',
    'Days Done': 'number',
    'Break Points': 'rich_text',
    Fit: 'select',
    'One Adjustment': 'rich_text',
    'Risk + Plan': 'rich_text',
    Temperature: 'number',
    'Buddy Reflected': 'checkbox',
  },
}

export interface SchemaIssue {
  db: string
  property: string
  expectedType: string
  /** Present when the property exists but is the wrong type. */
  actualType?: string
}

/** Compare a database's actual properties against the expected schema. `actual` is Notion's
 *  `database.properties` map (name → { type }). */
export function validateSchema(
  dbKey: DbKey,
  actual: Record<string, { type?: string } | undefined>,
): SchemaIssue[] {
  const label = DB_LABEL[dbKey]
  const issues: SchemaIssue[] = []
  for (const [name, type] of Object.entries(EXPECTED_SCHEMA[dbKey])) {
    const prop = actual?.[name]
    if (!prop) issues.push({ db: label, property: name, expectedType: type })
    else if (prop.type !== type) issues.push({ db: label, property: name, expectedType: type, actualType: prop.type })
  }
  return issues
}
