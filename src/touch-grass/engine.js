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

// Async by design — swap body for a real API call in a later phase
// without changing any caller.
export async function generateDiscovery(tier) {
  const pool = DISCOVERIES[tier]
  return pool[Math.floor(Math.random() * pool.length)]
}
