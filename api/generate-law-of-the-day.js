// Vercel Cron target: once a day, asks Claude to write a fresh
// scenario/explanation pair for one law (chosen deterministically by
// getGeneratorLawId — never by the model), and stores it in Vercel Blob at
// a stable path the client can fetch via api/law-of-the-day-content.js.
//
// This holds a real secret (ANTHROPIC_API_KEY) unlike every other function
// in this repo, so it's locked down with CRON_SECRET rather than the
// origin/rate-limit checks the BYO-token relays use — Vercel Cron requests
// carry an Authorization: Bearer $CRON_SECRET header automatically once
// that env var is set on the project.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { put } from '@vercel/blob'
import { getGeneratorLawId } from './lib/generatorRotation.js'

// Read as a plain file rather than a JSON module import — avoids depending
// on Vercel's exact Node runtime version supporting import attributes.
const here = dirname(fileURLToPath(import.meta.url))
const laws = JSON.parse(readFileSync(resolve(here, '../src/law-of-the-day/data/laws.json'), 'utf8'))

const MODEL = 'claude-sonnet-5'
const BLOB_PATH_PREFIX = 'law-of-the-day'

const SCHEMA = {
  type: 'object',
  properties: {
    scenarioText: { type: 'string' },
    explanationText: { type: 'string' },
  },
  required: ['scenarioText', 'explanationText'],
  additionalProperties: false,
}

function buildPrompt(law, referenceLaws) {
  const examples = referenceLaws
    .map((l) => `Law "${l.lawTitle}":\nscenarioText: ${l.scenarioText}\nexplanationText: ${l.explanationText}`)
    .join('\n\n')

  const system = `You write short original content for a daily quiz app based on Robert Greene's "The 48 Laws of Power". You are given a fixed law title — you do not choose which law, and you never reveal the answer inside the scenario. Write only the two requested fields.`

  const user = `Write a fresh scenarioText and explanationText for this law:

Law title: "${law.lawTitle}"

Constraints:
- scenarioText: 2-4 original sentences (~40-70 words) depicting a contemporary, relatable, concrete situation (workplace, friendship, dating, social media, family, business, sports, school, etc.) where this law's dynamic is at play. Do not name the law, mention Robert Greene, or reference the book.
- explanationText: 2-4 original sentences that name the law being demonstrated and explain, in your own words, why the scenario exemplifies it.
- Wholly original prose — do not quote or closely paraphrase any published text from "The 48 Laws of Power".
- Keep sentences short enough to read comfortably on a phone quiz card.
- Make this scenario clearly different from the reference examples below (different domain/situation), even though it illustrates the same law as one of them if applicable.

Reference examples of the style/length/tone (for other laws, for calibration only):

${examples}`

  return { system, user }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Use GET.' })
    return
  }

  const auth = req.headers.authorization
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const lawId = getGeneratorLawId()
  const law = laws.find((l) => l.id === lawId)
  if (!law) {
    res.status(500).json({ message: `No law found for generated id ${lawId}` })
    return
  }

  const referenceLaws = laws.filter((l) => l.id !== lawId).slice(0, 3)
  const { system, user } = buildPrompt(law, referenceLaws)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      system,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock) throw new Error('No text block in Claude response')
    const generated = JSON.parse(textBlock.text)

    if (typeof generated.scenarioText !== 'string' || typeof generated.explanationText !== 'string') {
      throw new Error('Malformed generated content shape')
    }

    const blob = await put(
      `${BLOB_PATH_PREFIX}/${lawId}.json`,
      JSON.stringify({
        lawId,
        scenarioText: generated.scenarioText,
        explanationText: generated.explanationText,
        generatedAt: new Date().toISOString(),
      }),
      {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      },
    )

    res.status(200).json({ lawId, url: blob.url })
  } catch (err) {
    console.error('generate-law-of-the-day failed:', err)
    res.status(502).json({ message: `Generation failed: ${err.message}` })
  }
}
