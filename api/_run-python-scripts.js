import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Use POST' })
    return
  }

  const token = req.headers['x-notion-token']
  const dbId = req.headers['x-notion-db']

  if (!token || !dbId) {
    console.error('[run-python-scripts] Missing Notion token or DB ID headers')
    res.status(400).json({ message: 'Missing auth headers' })
    return
  }

  // We return immediately so the UI doesn't hang waiting for 4 python scripts to finish
  res.status(200).json({ message: 'Background scripts started' })

  const env = { 
    ...process.env, 
    CLICKDECK_NOTION_TOKEN: token, 
    CLICKDECK_DB_ID: dbId 
  }

  try {
    console.log('[run-python-scripts] Starting post-add scripts...')
    await execAsync('python scripts/backfill-covers.py', { env })
    await execAsync('python scripts/force-sync-prices.py', { env })
    await execAsync('python scripts/dramatize-journal.py', { env })
    await execAsync('python scripts/verify-steam-names.py', { env })
    console.log('[run-python-scripts] All scripts finished successfully.')
  } catch (err) {
    console.error('[run-python-scripts] Error running scripts:', err)
  }
}
