import { formatCurrency } from '../lib/currency';
import { formatDaysUntil } from '../lib/upcoming';

/**
 * The one interrupt surface in the app: a slim strip naming what's about to
 * happen — a subscription can post a charge (Spotify) or a payment you
 * collect (rent from a tenant), so this never assumes which. Deliberately not
 * a nav tab — the header is already full.
 *
 * **Not dismissible, by request.** It was originally snoozeable for 24h, but a
 * snooze on something still unresolved just hides the one thing you wanted to
 * be told about, and it stayed hidden. It's either due soon or it isn't; the
 * strip disappears on its own once it lands in the ledger.
 *
 * Tinted background + token-coloured text rather than a solid fill, which is
 * the contrast pattern the rest of the app settled on (a solid --color-warning
 * with white text measured ~2:1 in dark theme).
 */
export default function UpcomingBanner({ bills, leadDays, categoriesById, onView }) {
  if (!bills || bills.length === 0) return null;

  const soonest = bills[0];
  // Signed, not summed raw — a Spotify charge and rent collected as a
  // landlord move money in opposite directions, and adding their magnitudes
  // together produced a "total" that meant nothing (the same mistake the
  // Total Global Budget bar made before it was fixed to net properly).
  const total = bills.reduce((acc, b) => {
    const amt = Number(b.sub?.amount) || 0;
    return acc + (b.sub?.type === 'Income' ? amt : -amt);
  }, 0);
  const tone = 'var(--color-warning)';

  // The category's own emoji, so the strip carries the same visual identity the
  // ledger and the agenda use rather than a generic bell.
  const soonestIcon = categoriesById?.get(soonest.sub.categoryId)?.icon || '';
  // Income due (rent collected as a landlord) reads very differently from an
  // expense about to post — the sign says which without naming the type.
  const sign = soonest.sub.type === 'Income' ? '+' : '−';

  const message = bills.length === 1
    ? `${soonestIcon ? soonestIcon + ' ' : ''}${soonest.sub.name} · ${sign}${formatCurrency(soonest.sub.amount)} due ${formatDaysUntil(soonest.daysUntil)}`
    : `${bills.length} due in the next ${leadDays} days · ${total >= 0 ? '+' : '−'}${formatCurrency(Math.abs(total))}`;

  return (
    <div
      className="card-container stagger-1"
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

    </div>
  );
}
