import { formatCurrency } from '../lib/currency';
import { formatDaysUntil } from '../lib/upcoming';

/**
 * The one interrupt surface in the app: a slim strip naming what's about to be
 * charged. Deliberately not a nav tab — the header is already full — and
 * deliberately dismissible, because a warning you can't silence becomes
 * furniture within a week.
 *
 * Tinted background + token-coloured text rather than a solid fill, which is
 * the contrast pattern the rest of the app settled on (a solid --color-warning
 * with white text measured ~2:1 in dark theme).
 */
export default function UpcomingBanner({ bills, leadDays, onView, onDismiss }) {
  if (!bills || bills.length === 0) return null;

  const soonest = bills[0];
  const total = bills.reduce((acc, b) => acc + (Number(b.sub?.amount) || 0), 0);
  const tone = 'var(--color-warning)';

  const message = bills.length === 1
    ? `${soonest.sub.name} · ${formatCurrency(soonest.sub.amount)} due ${formatDaysUntil(soonest.daysUntil)}`
    : `${bills.length} bills due in the next ${leadDays} days · ${formatCurrency(total)}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-md)',
        marginBottom: 'var(--space-md)',
        backgroundColor: `color-mix(in srgb, ${tone} 12%, var(--color-surface))`,
        border: `1px solid color-mix(in srgb, ${tone} 40%, transparent)`,
        borderRadius: 'var(--radius-lg)',
        minWidth: 0
      }}
    >
      <span aria-hidden style={{ fontSize: '18px', flex: 'none' }}>⏰</span>

      <button
        type="button"
        onClick={onView}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          font: 'inherit',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-ink)',
          // One line, always — the strip must never grow into a paragraph.
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        title={message}
      >
        {message}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss for 24 hours"
        title="Dismiss for 24 hours"
        style={{
          flex: 'none',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 6px',
          fontSize: 'var(--text-md)',
          lineHeight: 1,
          color: 'var(--color-muted)'
        }}
      >
        ×
      </button>
    </div>
  );
}
