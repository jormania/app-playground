// ─────────────────────────────────────────────────────────────
// SVG pose library ported 1:1 from the Gemini static kettlebell page.
//
// Five reusable Haring-style poses on a 100×100 grid (black line-art,
// white head, solid-red kettlebell, floor line) plus a strongman
// difficulty icon on a 32×32 grid. These are re-baked verbatim as React
// components and reused across the twelve movements. Where a movement
// has phases Gemini didn't draw, we use fewer frames; where both frames
// share a pose, the second is mirrored to read as a left/right or
// alternating rep. No figures live outside this ported set.
// ─────────────────────────────────────────────────────────────

// Difficulty pip — flexing strongman (32×32 grid).
export const STRONGMAN = (
  <>
    <circle cx="16" cy="8" r="5" fill="#FFFF00" stroke="#000" strokeWidth="3" />
    <path d="M 6 22 L 16 14 L 26 22" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 4 14 C 8 8, 24 8, 28 14" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
    <circle cx="4" cy="14" r="3" fill="#FF0000" stroke="#000" strokeWidth="2" />
    <circle cx="28" cy="14" r="3" fill="#FF0000" stroke="#000" strokeWidth="2" />
    <path d="M 12 2 L 12 4 M 20 2 L 20 4 M 16 0 L 16 3" stroke="#000" strokeWidth="2" strokeLinecap="round" />
  </>
);

export function StrongmanIcon() {
  return (
    <svg className="pip" viewBox="0 0 32 32" aria-hidden="true">
      {STRONGMAN}
    </svg>
  );
}

// ─── Poses (100×100 grid) ──────────────────────────────────────

export const POSES = {
  // Hip hinge / loaded down position — kettlebell hanging low.
  hinge: (
    <>
      <line x1="10" y1="90" x2="90" y2="90" stroke="#000" strokeWidth="4" strokeLinecap="round" />
      <circle cx="35" cy="35" r="8" fill="#FFF" stroke="#000" strokeWidth="4" />
      <path d="M 35 43 L 25 65 L 40 85 L 30 90 M 40 85 L 50 90" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 32 46 L 55 60 L 70 75" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="70" cy="83" r="7" fill="#FF0000" stroke="#000" strokeWidth="3" />
      <path d="M 65 77 C 70 73, 75 73, 75 77" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
      <path d="M 15 60 C 10 70, 20 80, 25 80" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
    </>
  ),

  // Standing lockout — kettlebell floating out at shoulder height.
  stand: (
    <>
      <line x1="10" y1="90" x2="90" y2="90" stroke="#000" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="20" r="8" fill="#FFF" stroke="#000" strokeWidth="4" />
      <path d="M 50 28 L 50 60 L 40 90 M 50 60 L 60 90" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 50 35 L 70 35 L 85 35" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="93" cy="35" r="7" fill="#FF0000" stroke="#000" strokeWidth="3" />
      <path d="M 88 32 C 93 28, 98 28, 98 32" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
      <path d="M 30 15 L 20 10 M 70 15 L 80 10 M 50 5 L 50 0" stroke="#000" strokeWidth="3" strokeLinecap="round" />
    </>
  ),

  // Overhead press — kettlebell locked out above the head.
  press: (
    <>
      <line x1="10" y1="90" x2="90" y2="90" stroke="#000" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="40" r="8" fill="#FFF" stroke="#000" strokeWidth="4" />
      <path d="M 50 48 L 50 70 L 40 90 M 50 70 L 60 90" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 50 50 L 70 35 L 70 15" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="70" cy="8" r="7" fill="#FF0000" stroke="#000" strokeWidth="3" />
      <path d="M 65 14 C 70 18, 75 18, 75 14" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
      <path d="M 60 20 L 60 30 M 80 20 L 80 30" stroke="#000" strokeWidth="3" strokeLinecap="round" />
    </>
  ),

  // Deep squat — kettlebell held at the chest.
  squat: (
    <>
      <line x1="10" y1="90" x2="90" y2="90" stroke="#000" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="30" r="8" fill="#FFF" stroke="#000" strokeWidth="4" />
      <path d="M 50 38 L 50 65 L 30 80 L 35 90 M 50 65 L 70 80 L 65 90" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 40 45 C 50 55, 60 45, 60 45" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="48" r="7" fill="#FF0000" stroke="#000" strokeWidth="3" />
      <path d="M 20 60 L 25 70 M 80 60 L 75 70" stroke="#000" strokeWidth="3" strokeLinecap="round" />
    </>
  ),

  // Floor / plank — one arm rowing the kettlebell off the ground.
  plank: (
    <>
      <line x1="10" y1="80" x2="90" y2="80" stroke="#000" strokeWidth="4" strokeLinecap="round" />
      <circle cx="20" cy="50" r="8" fill="#FFF" stroke="#000" strokeWidth="4" />
      <path d="M 28 50 L 55 55 L 85 75" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 35 52 L 30 75" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
      <path d="M 35 52 L 45 40" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
      <circle cx="45" cy="33" r="7" fill="#FF0000" stroke="#000" strokeWidth="3" />
      <path d="M 50 40 C 45 45, 45 45, 40 40" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

// A single framed pose with its phase caption. `flip` mirrors it
// horizontally so repeated poses read as left/right reps.
export function Pose({ name, flip, label }) {
  const content = POSES[name];
  return (
    <figure className="pose">
      <svg viewBox="0 0 100 100" role="img" aria-label={label}>
        {flip ? <g transform="translate(100,0) scale(-1,1)">{content}</g> : content}
      </svg>
      {label ? <figcaption>{label}</figcaption> : null}
    </figure>
  );
}
