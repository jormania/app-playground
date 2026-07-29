/**
 * Nora, as a small avatar rather than the 👧 emoji.
 *
 * The emoji renders dark-haired and toddler-proportioned in every major emoji
 * font, which simply isn't her. Drawn instead of borrowed so it can be right:
 * blonde, long-haired, early-teen proportions, with the oversized eyes and
 * light linework of an anime portrait.
 *
 * Purely decorative — it always sits next to the word "Nora", so it carries no
 * information a screen reader needs and stays out of the accessibility tree.
 * Sized in `em` by default so it tracks whatever text it sits beside.
 */
export default function NoraAvatar({ size = '1.3em', style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', verticalAlign: '-0.25em', ...style }}
    >
      {/* Long hair, behind everything — falls well past the shoulders, with a
          gap down the middle so the face and neck read clearly. */}
      <path
        d="M16 2.4c-6.8 0-10.7 4.5-10.7 11.2 0 3.6-.4 8.4-1.2 13.2-.3 1.8-.6 3.5-1 5.2h7c.5-4.9.8-9.5.9-13.9.2-6 2.5-9.1 5-9.1s4.8 3.1 5 9.1c.1 4.4.4 9 .9 13.9h7c-.4-1.7-.7-3.4-1-5.2-.8-4.8-1.2-9.6-1.2-13.2C26.7 6.9 22.8 2.4 16 2.4z"
        fill="#E0AE3E"
      />

      {/* Neck and shoulders */}
      <path d="M14 19.6h4v4.1c0 1.1-.9 2-2 2s-2-.9-2-2v-4.1z" fill="#EFC5A4" />
      <path
        d="M16 24.6c3.6 0 6.6 2.9 7.2 7.4H8.8c.6-4.5 3.6-7.4 7.2-7.4z"
        fill="#7AA2F7"
      />

      {/* Face — a longer oval than a small child's, with a softer chin. */}
      <path
        d="M16 6.1c3.9 0 6.3 2.5 6.3 6.6v2.6c0 4.4-2.6 7.6-6.3 7.6s-6.3-3.2-6.3-7.6v-2.6c0-4.1 2.4-6.6 6.3-6.6z"
        fill="#F8DBC1"
      />

      {/* Fringe: side-swept, sitting over the forehead. */}
      <path
        d="M16 4.2c-5.4 0-8.4 3.4-8.4 8.6 0 1 .1 1.9.3 2.7.5-2.9 1.8-5 3.8-6.2 1.6 1.8 3.5 2.8 5.7 2.9 2.2.1 4.3-.7 6-2.2.9 1.4 1.5 3.2 1.8 5.5.2-.8.3-1.7.3-2.7 0-5.2-3-8.6-9.5-8.6z"
        fill="#F3C948"
      />

      {/* Eyes. Large irises with a highlight and a heavy upper lash line —
          the shorthand that reads as "anime" even at 20px. */}
      {[12.9, 19.1].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="15.2" rx="1.75" ry="2.25" fill="#4C7FB8" />
          <circle cx={cx} cy="15.6" r="0.95" fill="#2A2A33" />
          <circle cx={cx - 0.55} cy="14.3" r="0.62" fill="#FFFFFF" />
          <path
            d={`M${cx - 2.1} 13.2c.55-.8 1.25-1.2 2.1-1.2s1.55.4 2.1 1.2`}
            fill="none"
            stroke="#4A3626"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* Mouth */}
      <path
        d="M14.9 19.1c.35.5.75.75 1.1.75s.75-.25 1.1-.75"
        fill="none"
        stroke="#C07C63"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
