import { formatCurrency } from '../lib/currency';
import { formatDaysUntil } from '../lib/upcoming';
import { getCategoryColor } from '../lib/colors';
import { parseTxDate } from '../lib/period';

/**
 * The "calendar", as an agenda rather than a month grid.
 *
 * A grid would cost a lot of vertical space to say very little — a handful of
 * recurring bills a month means most cells are empty — and it reads badly on a
 * phone. A chronological list answers the actual question ("what's coming, and
 * when") in a fraction of the room.
 */
export default function UpcomingBills({ bills, categories, horizonDays }) {
  const categoriesById = new Map((categories || []).map(c => [c.id, c]));

  const netTotal = (bills || []).reduce((acc, b) => {
    const amount = Number(b.sub?.amount) || 0;
    return acc + (b.sub?.type === 'Income' ? amount : -amount);
  }, 0);

  const formatDue = (dueDate) => {
    const d = parseTxDate(dueDate);
    return d ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : dueDate;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>🗓️ Next {horizonDays} Days</h2>
        {bills && bills.length > 0 && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
            Net{' '}
            <strong style={{ color: netTotal >= 0 ? 'var(--color-success)' : 'var(--color-ink)' }}>
              {netTotal >= 0 ? '+' : '−'}{formatCurrency(Math.abs(netTotal))}
            </strong>
          </span>
        )}
      </div>

      {!bills || bills.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', margin: 0, fontStyle: 'italic' }}>
          Nothing due in the next {horizonDays} days. Recurring payments you add in
          Settings will appear here before they are charged.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {bills.map(b => {
            const cat = categoriesById.get(b.sub.categoryId);
            const catColor = getCategoryColor(cat?.name || '');
            const isIncome = b.sub.type === 'Income';
            return (
              <div
                key={`${b.sub.id}:${b.dueDate}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-sm)',
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `3px solid ${catColor}`,
                  opacity: b.alreadyPosted ? 0.55 : 1,
                  minWidth: 0
                }}
              >
                {/* The category's own emoji, matching how the ledger and the
                    charts identify it — a bill is far easier to place at a
                    glance by its icon than by reading the name. */}
                <span aria-hidden style={{ flex: 'none', fontSize: '16px', width: '20px', textAlign: 'center' }}>
                  {cat?.icon || '🔁'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-sm)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {b.sub.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatDue(b.dueDate)} · {formatDaysUntil(b.daysUntil)}
                    {b.alreadyPosted && ' · already recorded'}
                  </div>
                </div>
                <div style={{
                  flex: 'none',
                  fontWeight: 'var(--weight-bold)',
                  fontSize: 'var(--text-sm)',
                  color: isIncome ? 'var(--color-success)' : 'var(--color-ink)'
                }}>
                  {isIncome ? '+' : '−'}{formatCurrency(b.sub.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
