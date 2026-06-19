// Stylized (not astronomically exact) constellation line-figures.
// Points are normalized 0..1 within a bounding box; lines connect point indices.

// Simplified but recognizable approximations of the real zodiac asterisms.
// point index 0 is the brightest/lead star (rendered larger).
export const CONSTELLATIONS = {
  // shallow bent line (Hamal–Sheratan)
  aries:       { points: [[0.14, 0.60], [0.46, 0.46], [0.64, 0.42], [0.88, 0.50]], lines: [[0, 1], [1, 2], [2, 3]] },
  // Hyades V (Aldebaran) opening up-right, with two horns
  taurus:      { points: [[0.40, 0.52], [0.12, 0.64], [0.46, 0.30], [0.80, 0.16], [0.90, 0.46]], lines: [[1, 0], [0, 2], [2, 3], [0, 4]] },
  // the twins — two near-parallel figures joined at the shoulders
  gemini:      { points: [[0.25, 0.10], [0.30, 0.46], [0.34, 0.86], [0.60, 0.12], [0.64, 0.48], [0.70, 0.86]], lines: [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4]] },
  // faint inverted Y
  cancer:      { points: [[0.50, 0.85], [0.50, 0.50], [0.30, 0.20], [0.70, 0.18]], lines: [[0, 1], [1, 2], [1, 3]] },
  // the Sickle (Regulus) + hindquarters triangle (Denebola)
  leo:         { points: [[0.12, 0.52], [0.14, 0.38], [0.22, 0.28], [0.34, 0.30], [0.40, 0.56], [0.66, 0.52], [0.88, 0.45], [0.66, 0.72]], lines: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [5, 7]] },
  // sprawling branched figure down to Spica
  virgo:       { points: [[0.15, 0.30], [0.38, 0.40], [0.58, 0.34], [0.66, 0.62], [0.85, 0.74], [0.50, 0.70]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]] },
  // the scales — a quadrilateral with two hanging stars
  libra:       { points: [[0.30, 0.30], [0.62, 0.22], [0.78, 0.55], [0.45, 0.62], [0.20, 0.72], [0.85, 0.78]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5]] },
  // claws meeting at Antares, body curving to the stinger
  scorpio:     { points: [[0.20, 0.18], [0.42, 0.26], [0.40, 0.42], [0.50, 0.58], [0.64, 0.72], [0.74, 0.84], [0.62, 0.90]], lines: [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
  // the Teapot asterism — body diamond + triangular spout
  sagittarius: { points: [[0.38, 0.42], [0.62, 0.44], [0.66, 0.66], [0.42, 0.70], [0.18, 0.56]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 0], [4, 3]] },
  // a tilted triangular boat
  capricorn:   { points: [[0.12, 0.42], [0.50, 0.30], [0.88, 0.40], [0.60, 0.80]], lines: [[0, 1], [1, 2], [2, 3], [3, 0]] },
  // the water stream — a long zigzag
  aquarius:    { points: [[0.10, 0.40], [0.30, 0.30], [0.45, 0.42], [0.60, 0.30], [0.78, 0.40], [0.88, 0.62]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },
  // the two fish cords meeting, with the Circlet ring at one end
  pisces:      { points: [[0.10, 0.55], [0.32, 0.50], [0.52, 0.46], [0.50, 0.22], [0.72, 0.40], [0.82, 0.32], [0.88, 0.44], [0.80, 0.52]], lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [6, 7], [7, 4]] },
}

const SIGNS = [
  [1, 20, 'aquarius'], [2, 19, 'pisces'], [3, 21, 'aries'], [4, 20, 'taurus'],
  [5, 21, 'gemini'], [6, 21, 'cancer'], [7, 23, 'leo'], [8, 23, 'virgo'],
  [9, 23, 'libra'], [10, 23, 'scorpio'], [11, 22, 'sagittarius'], [12, 22, 'capricorn'],
]

export function getZodiac(date) {
  const m = date.getMonth() + 1, d = date.getDate()
  for (let i = SIGNS.length - 1; i >= 0; i--) {
    const [sm, sd, name] = SIGNS[i]
    if (m > sm || (m === sm && d >= sd)) return name
  }
  return 'capricorn' // Jan 1–19
}
