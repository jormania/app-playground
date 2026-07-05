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
import { titleLeakWords, scenarioLeaksTitle } from '../src/law-of-the-day/lib/leakCheck.js'

// Read as a plain file rather than a JSON module import — avoids depending
// on Vercel's exact Node runtime version supporting import attributes.
const here = dirname(fileURLToPath(import.meta.url))
const laws = JSON.parse(readFileSync(resolve(here, '../src/law-of-the-day/data/laws.json'), 'utf8'))

const MODEL = 'claude-sonnet-5'
const BLOB_PATH_PREFIX = 'law-of-the-day'
const MAX_ATTEMPTS = 2
const MIN_FIELD_CHARS = 30

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

  const leakWords = titleLeakWords(law.lawTitle)
  const leakClause = leakWords.length
    ? ` Do NOT use any of these distinctive words from the title, or their obvious inflections (plurals, verb tenses), anywhere in scenarioText: ${leakWords.map((w) => `"${w}"`).join(', ')}. The scenario must let a reader deduce the law from the situation alone, never from a word lifted out of its name.`
    : ''

  const system = `You write short original content for a daily quiz app based on Robert Greene's "The 48 Laws of Power". You are given a fixed law title — you do not choose which law, and you never reveal the answer inside the scenario. Write only the two requested fields.`

  const user = `Write a fresh scenarioText and explanationText for this law:

Law title: "${law.lawTitle}"

Constraints:
- scenarioText: 2-4 original sentences (~40-70 words) depicting a contemporary, relatable, concrete situation (workplace, friendship, dating, social media, family, business, sports, school, etc.) where this law's dynamic is at play. Do not name the law, mention Robert Greene, or reference the book.${leakClause}
- explanationText: 2-4 original sentences that name the law being demonstrated and explain, in your own words, why the scenario exemplifies it.
- Wholly original prose — do not quote or closely paraphrase any published text from "The 48 Laws of Power".
- Keep sentences short enough to read comfortably on a phone quiz card.
- Make this scenario clearly different from the reference examples below (different domain/situation), even though it illustrates the same law as one of them if applicable.

Reference examples of the style/length/tone (for other laws, for calibration only):

${examples}`

  return { system, user }
}

// Guards the same invariants the static data test enforces, plus the leak rule.
// Returns an error string to feed back to the model, or null when clean.
function validateGenerated(generated, law) {
  if (typeof generated.scenarioText !== 'string' || typeof generated.explanationText !== 'string') {
    return 'Response was missing scenarioText or explanationText.'
  }
  if (generated.scenarioText.trim().length < MIN_FIELD_CHARS || generated.explanationText.trim().length < MIN_FIELD_CHARS) {
    return 'scenarioText and explanationText must each be at least a couple of full sentences.'
  }
  const leaks = scenarioLeaksTitle(generated.scenarioText, law.lawTitle)
  if (leaks.length) {
    return `scenarioText leaked these forbidden title words: ${leaks.join(', ')}. Rewrite it without them or any inflection of them.`
  }
  return null
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

    // Generate, then validate against the leak rule and the length/shape
    // invariants. A validation failure isn't fatal — we feed the specific
    // problem back and retry, and only give up (keeping the static text) after
    // MAX_ATTEMPTS. This is what stops a stray generation from re-introducing
    // an answer-leaking scenario over future seasons.
    const messages = [{ role: 'user', content: user }]
    let generated = null
    let lastError = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        thinking: { type: 'adaptive' },
        system,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages,
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock) throw new Error('No text block in Claude response')
      const candidate = JSON.parse(textBlock.text)

      lastError = validateGenerated(candidate, law)
      if (!lastError) {
        generated = candidate
        break
      }

      console.warn(`generate-law-of-the-day: attempt ${attempt} rejected for law ${lawId} — ${lastError}`)
      messages.push({ role: 'assistant', content: textBlock.text })
      messages.push({ role: 'user', content: `That draft was rejected: ${lastError} Return corrected scenarioText and explanationText.` })
    }

    if (!generated) {
      throw new Error(`No valid generation after ${MAX_ATTEMPTS} attempts — ${lastError}`)
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
