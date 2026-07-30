import { formatCurrency } from '../lib/currency';
import { formatDaysUntil } from '../lib/upcoming';
import { getCategoryColor } from '../lib/colors';
import { parseTxDate } from '../lib/period';

/**
 * The "calendar", as an agenda rather than a month grid.
 *
 * A grid would cost a lot of vertical space to say very little — a handful of
 * recurring items a month means most cells are empty — and it reads badly on a
 * phone. A chronological list answers the actual question ("what's coming, and
 * when") in a fraction of the room.
 *
 * Two sources feed one list: `bills` (subscription occurrences — a charge the
 * engine will post, or income like rent it's expecting) and `transactions`
 * (one-off future-dated entries already in the ledger — a hotel stay you
 * booked and logged ahead of time). Split into Expenses and Income so a
 * landlord's rent and a streaming charge don't blur into one undifferentiated
 * list; the Net stays a single combined figure, because that's the number
 * that actually answers "am I in the clear the next 30 days".
 */
export default function UpcomingBills({ bills, transactions, categories, horizonDays }) {
  const categoriesById = new Map((categories || []).map(c => [c.id, c]));

  // One shape for both sources, so the render below doesn't care which kind
  // of row it's drawing.
  const items = [
    ...(bills || []).map(b => ({
      key: `sub:${b.sub.id}:${b.dueDate}`,
      kind: 'subscription',
      name: b.sub.name,
      amount: b.sub.amount,
      type: b.sub.type,
      categoryId: b.sub.categoryId,
      originalAmount: b.sub.originalAmount,
      originalCurrency: b.sub.originalCurrency,
      dueDate: b.dueDate,
      daysUntil: b.daysUntil,
      alreadyPosted: b.alreadyPosted,
    })),
    ...(transactions || []).map(t => ({
      key: `tx:${t.id}`,
      kind: 'transaction',
      name: t.name,
      amount: t.amount,
      type: t.type,
      categoryId: t.categoryId,
      originalAmount: t.originalAmount,
      originalCurrency: t.originalCurrency,
      dueDate: t.dueDate,
      daysUntil: t.daysUntil,
      alreadyPosted: false,
    })),
  ].sort((a, b) => (a.dueDate === b.dueDate ? 0 : (a.dueDate < b.dueDate ? -1 : 1)));

  const netTotal = items.reduce((acc, i) => {
    const amount = Number(i.amount) || 0;
    return acc + (i.type === 'Income' ? amount : -amount);
  }, 0);

  const expenseItems = items.filter(i => i.type === 'Expense');
  const incomeItems = items.filter(i => i.type === 'Income');

  const formatDue = (dueDate) => {
    const d = parseTxDate(dueDate);
    return d ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : dueDate;
  };

  const renderRow = (item) => {
    const cat = categoriesById.get(item.categoryId);
    const catColor = getCategoryColor(cat?.name || '');
    const isIncome = item.type === 'Income';
    return (
      <div
        key={item.key}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm)',
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          borderLeft: `3px solid ${catColor}`,
          opacity: item.alreadyPosted ? 0.55 : 1,
          minWidth: 0
        }}
      >
        {/* The category's own emoji, matching how the ledger and the charts
            identify it. A one-off already in the ledger falls back to a pin
            rather than the recurring-arrows glyph — it isn't a pattern, it's
            a single logged commitment. */}
        <span aria-hidden style={{ flex: 'none', fontSize: '16px', width: '20px', textAlign: 'center' }}>
          {cat?.icon || (item.kind === 'transaction' ? '📌' : '🔁')}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-sm)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {item.name}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {formatDue(item.dueDate)} · {formatDaysUntil(item.daysUntil)}
            {item.alreadyPosted && ' · already recorded'}
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div style={{
            fontWeight: 'var(--weight-bold)',
            fontSize: 'var(--text-sm)',
            color: isIncome ? 'var(--color-success)' : 'var(--color-ink)'
          }}>
            {isIncome ? '+' : '−'}{formatCurrency(item.amount)}
          </div>
          {item.originalAmount != null && item.originalCurrency && (
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
              ({Number(item.originalAmount).toLocaleString('en-US', { maximumFractionDigits: 2 })} {item.originalCurrency})
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (title, sectionItems) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </h3>
      {sectionItems.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', margin: '0 0 var(--space-xs) 0', fontStyle: 'italic', fontSize: 'var(--text-sm)' }}>
          Nothing due.
        </p>
      ) : (
        sectionItems.map(renderRow)
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>🗓️ Next {horizonDays} Days</h2>
        {items.length > 0 && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
            Net{' '}
            <strong style={{ color: netTotal >= 0 ? 'var(--color-success)' : 'var(--color-ink)' }}>
              {netTotal >= 0 ? '+' : '−'}{formatCurrency(Math.abs(netTotal))}
            </strong>
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', margin: 0, fontStyle: 'italic' }}>
          Nothing due in the next {horizonDays} days. Add a recurring subscription in Settings,
          or log a future-dated transaction, and it will appear here ahead of time.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-lg)' }}>
          {renderSection('💸 Expenses', expenseItems)}
          {renderSection('💰 Income', incomeItems)}
        </div>
      )}
    </div>
  );
}
