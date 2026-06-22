// Stylized (not astronomically exact) constellation line-figures.
// Points are normalized 0..1 within a bounding box; lines connect point indices.

// Line-figures following the connection topology of a standard zodiac chart.
// Normalized 0..1 within the constellation box (x right, y down).
export const CONSTELLATIONS = {
  // head cluster (Hamal) with a long tail trailing down-left
  aries:       { points: [[0.55, 0.12], [0.78, 0.06], [0.70, 0.22], [0.32, 0.36], [0.16, 0.60], [0.20, 0.82]], lines: [[0, 1], [0, 2], [0, 3], [3, 4], [4, 5]] },
  // the bull's face leading to the V, with two long horns (Aldebaran at the join)
  taurus:      { points: [[0.08, 0.20], [0.30, 0.40], [0.52, 0.54], [0.68, 0.66], [0.84, 0.80], [0.74, 0.42], [0.93, 0.26]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]] },
  // the twins — two figures, heads up, joined at shoulders and hips, arms out
  gemini:      { points: [[0.34, 0.10], [0.32, 0.34], [0.30, 0.60], [0.24, 0.86], [0.62, 0.06], [0.64, 0.32], [0.66, 0.58], [0.74, 0.84], [0.12, 0.42], [0.86, 0.44]], lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [1, 5], [2, 6], [1, 8], [5, 9]] },
  // the faint crab — a central star with four arms
  cancer:      { points: [[0.18, 0.34], [0.46, 0.46], [0.58, 0.22], [0.50, 0.78], [0.84, 0.52]], lines: [[0, 1], [1, 2], [1, 3], [1, 4]] },
  // the Sickle (backwards question mark, Regulus) joining the hindquarters triangle (Denebola)
  leo:         { points: [[0.30, 0.16], [0.18, 0.22], [0.10, 0.36], [0.14, 0.52], [0.26, 0.58], [0.50, 0.50], [0.72, 0.46], [0.90, 0.40], [0.74, 0.66]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 6]] },
  // the maiden — a sprawling figure reaching down to Spica
  virgo:       { points: [[0.90, 0.20], [0.62, 0.34], [0.40, 0.42], [0.16, 0.50], [0.46, 0.66], [0.34, 0.82], [0.70, 0.60]], lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [1, 6]] },
  // the scales — an inverted V from a bright apex, two arms hanging
  libra:       { points: [[0.52, 0.16], [0.80, 0.42], [0.28, 0.46], [0.16, 0.74], [0.64, 0.70]], lines: [[0, 1], [0, 2], [1, 4], [2, 3]] },
  // claws meeting at Antares, the long body curving down to the stinger
  scorpio:     { points: [[0.86, 0.14], [0.90, 0.34], [0.66, 0.30], [0.58, 0.46], [0.52, 0.60], [0.44, 0.72], [0.32, 0.80], [0.22, 0.72], [0.18, 0.56]], lines: [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]] },
  // the Teapot — six-star body, spout, and a star marking the lid
  sagittarius: { points: [[0.28, 0.52], [0.44, 0.36], [0.60, 0.30], [0.76, 0.42], [0.72, 0.62], [0.52, 0.68], [0.40, 0.56], [0.64, 0.14]], lines: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [0, 6], [2, 7]] },
  // the lopsided boat / arrowhead
  capricorn:   { points: [[0.10, 0.32], [0.90, 0.16], [0.78, 0.50], [0.50, 0.74], [0.20, 0.62]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
  // the water-bearer — a top tail, a left branch, and the stream zigzagging right
  aquarius:    { points: [[0.16, 0.06], [0.24, 0.28], [0.06, 0.50], [0.46, 0.40], [0.64, 0.36], [0.54, 0.62], [0.72, 0.72], [0.88, 0.60]], lines: [[0, 1], [1, 2], [1, 3], [3, 4], [3, 5], [5, 6], [6, 7]] },
  // the two fish — a Circlet at top-right, a long cord to the knot, a small triangle at left
  pisces:      { points: [[0.78, 0.06], [0.70, 0.16], [0.84, 0.20], [0.72, 0.28], [0.60, 0.36], [0.50, 0.48], [0.40, 0.58], [0.30, 0.68], [0.22, 0.80], [0.10, 0.66], [0.18, 0.58]], lines: [[0, 2], [1, 2], [2, 3], [3, 1], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 8]] },
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

// whole days until the Sun crosses into the next sign (i.e. the current sign ends)
export function daysToNextSign(date) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  let best = null
  for (const yr of [today.getFullYear(), today.getFullYear() + 1]) {
    for (const [m, d] of SIGNS) {
      const bd = new Date(yr, m - 1, d)
      if (bd.getTime() > today.getTime() && (best === null || bd < best)) best = bd
    }
  }
  return best ? Math.round((best.getTime() - today.getTime()) / 86400000) : null
}
