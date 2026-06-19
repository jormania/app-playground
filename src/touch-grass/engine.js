import { getTimeOfDay, getSeason } from './context.js'

const DISCOVERIES = {
  common: [
    {
      name: 'A perfectly dry stone',
      description: 'A stone completely dry despite the surrounding soil being wet after yesterday\'s rain. You held it for a moment. It felt like it had been waiting.',
    },
    {
      name: 'A feather pointing north',
      description: 'A single grey feather, stuck upright in the dirt. It rotates slowly to face magnetic north whenever you approach.',
    },
    {
      name: 'An echo that came second',
      description: 'One of your footsteps echoed twice. The second echo was louder than the first.',
    },
    {
      name: 'A shadow with no source',
      description: 'A small, sharp shadow on the path. You looked up. Nothing overhead.',
    },
  ],
  uncommon: [
    {
      name: 'A jar of Tuesday',
      description: 'A small mason jar, sealed with wax, filled with what appears to be condensed Tuesday afternoon light. The label reads: best before never.',
    },
    {
      name: 'A broken clock showing the right time',
      description: 'A rusted pocket watch lying face-up in the grass. Both hands are missing, yet it shows exactly the correct time.',
    },
    {
      name: 'Someone else\'s memory',
      description: 'A vivid, involuntary recollection of riding a bicycle past lavender fields. You have never been to France. The bicycle is not yours.',
    },
    {
      name: 'A window with no building',
      description: 'A single pane of glass, frame and all, standing upright against nothing. Through it, the park looks slightly warmer than it actually is.',
    },
  ],
  rare: [
    {
      name: 'The gap between two seconds',
      description: 'Time stopped at the seam between one second and the next. You were the only thing still moving. A bird hung frozen mid-flight beside you.',
    },
    {
      name: 'An apology from the ground',
      description: 'The earth beneath your left foot shifted apologetically, as if it had made a small error. A faint tremor. No geological explanation.',
    },
    {
      name: 'A door with no wall',
      description: 'A wooden door stood in the middle of the path, hinged on nothing, slightly ajar. On the other side: more path, but the light was different.',
    },
    {
      name: 'Your name, written in bark',
      description: 'Not carved — written, in a clear and unhurried hand, as though the tree had been practicing for years.',
    },
  ],
  legendary: [
    {
      name: 'The last thought of a tree',
      description: 'You placed your palm on an oak and received its final thought from three centuries ago — something about the taste of October, expressed in rings.',
    },
    {
      name: 'A fold in the afternoon',
      description: 'The park folded once, briefly, like a piece of paper. You found yourself on the inside of the crease, looking at both sides of the day simultaneously.',
    },
    {
      name: 'Coordinates for something that doesn\'t exist yet',
      description: 'Carved into a smooth stone: a set of GPS coordinates, a date 40 years from now, and the words: you\'ll understand then.',
    },
  ],
}


function formatDuration(minutes) {
  if (minutes < 1) return 'less than a minute'
  if (minutes < 60) return `${Math.round(minutes)} minutes`
  const h = Math.floor(minutes / 60)
  return `${h} hour${h > 1 ? 's' : ''}`
}

async function fetchDiscovery(tier, durationMinutes, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You generate surreal discoveries for a walking app. A discovery is something impossible or dreamlike that the walker might have found outside. Respond with valid JSON only: {"name": "...", "description": "..."}. The name is 3–7 words. The description is one sentence only, 25 words maximum — poetic, precise, never whimsical or twee.`,
      messages: [
        {
          role: 'user',
          content: `Generate a ${tier} discovery. The walker was outside for ${formatDuration(durationMinutes)}. It is ${getTimeOfDay(new Date())} in ${getSeason(new Date())}.\n\nTier guide:\n- common: mildly uncanny. Something real that feels slightly wrong.\n- uncommon: clearly impossible. Physical laws politely ignored.\n- rare: reality-bending. The ground itself doesn't behave as expected.\n- legendary: mythic, awe-inspiring. The kind of thing that happens once.`,
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`API ${res.status}`)

  const data = await res.json()
  const text = data.content[0].text.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON in response')
  const parsed = JSON.parse(text.slice(start, end + 1))

  if (!parsed.name || !parsed.description) throw new Error('bad shape')
  return parsed
}

export function rollTier(durationMinutes) {
  let weights = { common: 60, uncommon: 30, rare: 8, legendary: 2 }

  if (durationMinutes >= 60) {
    weights = { common: 30, uncommon: 42, rare: 20, legendary: 8 }
  } else if (durationMinutes >= 30) {
    weights = { common: 48, uncommon: 36, rare: 13, legendary: 3 }
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll = Math.random() * total

  for (const [tier, weight] of Object.entries(weights)) {
    roll -= weight
    if (roll <= 0) return tier
  }
  return 'common'
}

export async function generateDiscovery(tier, durationMinutes, apiKey) {
  if (apiKey) {
    try {
      const discovery = await fetchDiscovery(tier, durationMinutes, apiKey)
      return { discovery, isStatic: false, apiAttempted: true }
    } catch (err) {
      console.warn('[touch-grass] API call failed, using static fallback:', err)
      const pool = DISCOVERIES[tier]
      return { discovery: pool[Math.floor(Math.random() * pool.length)], isStatic: true, apiAttempted: true }
    }
  }
  const pool = DISCOVERIES[tier]
  return { discovery: pool[Math.floor(Math.random() * pool.length)], isStatic: true, apiAttempted: false }
}
