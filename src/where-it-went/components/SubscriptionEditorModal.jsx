import { useState, useEffect, useId, useRef } from 'react';
import { formatAccountLabel } from '../lib/accounts';
import { Modal } from '../../ds/components/Modal';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { ConfirmModal } from '../../ds';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { BASE_CURRENCY, fetchRate, convert, impliedRate, formatRateNote, canConvert, orderedCurrencies } from '../lib/fx';

// Matches ds/Field's own input box, same reasoning as TransactionForm.jsx —
// a --color-bg fill read as a flat grey slab next to Field's own inputs.
const selectStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-2)', backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit'
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SubscriptionEditorModal({ isOpen, onClose, sub, data, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('Expense');
  const [frequency, setFrequency] = useState('Monthly');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [monthOfYear, setMonthOfYear] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [active, setActive] = useState(true);
  // A subscription has no fixed calendar date to convert against — it recurs
  // on a day of month, not a single day — so this is always "today's" rate,
  // a convenience for typing the figure once, not a historical record.
  const [currency, setCurrency] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [rate, setRate] = useState(null);
  const [rateDate, setRateDate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const categorySelectId = useId();
  const accountSelectId = useId();
  const activeCheckboxId = useId();
  const amountId = useId();
  const currencySelectId = useId();
  const baseAmountId = useId();
  const monthSelectId = useId();

  // Same three refs TransactionForm uses for the same reasons: don't overwrite
  // a hand-edited RON figure, don't restate a saved foreign amount at today's
  // rate just for reopening it, and let choosing a different account reset an
  // un-chosen currency back to that account's own.
  const baseTouched = useRef(false);
  const initialAmount = useRef('');
  const currencyTouched = useRef(false);

  useEffect(() => {
    if (sub) {
      setName(sub.name || '');
      setType(sub.type || 'Expense');
      setFrequency(sub.frequency || 'Monthly');
      setDayOfMonth(sub.dayOfMonth || 1);
      setMonthOfYear(sub.monthOfYear || 1);
      setCategoryId(sub.categoryId || '');
      setAccountId(sub.accountId || '');
      setActive(sub.active !== false);
      const seedForeign = sub.originalCurrency && sub.originalAmount != null;
      setAmount(seedForeign ? sub.originalAmount : (sub.amount ?? ''));
      setCurrency(sub.originalCurrency || '');
      setBaseAmount(seedForeign ? (sub.amount ?? '') : '');
      initialAmount.current = String(seedForeign ? sub.originalAmount : (sub.amount ?? ''));
      currencyTouched.current = !!sub.originalCurrency;
    } else {
      setName('');
      setAmount('');
      setType('Expense');
      setFrequency('Monthly');
      setDayOfMonth(1);
      setMonthOfYear(1);
      // A recurring bill is a subscription far more often than not, so start
      // there instead of whichever category the Notion query happened to
      // return first — that was frequently a mismatched guess the user had
      // to correct on every single add.
      const expenseCategories = (data?.categories || []).filter(c => c.type === 'Expense');
      const subsCategory = expenseCategories.find(c => (c.name || '').trim().toLowerCase() === 'subscriptions')
        || expenseCategories.find(c => /subscri/i.test(c.name || ''));
      setCategoryId(subsCategory?.id || data?.categories?.[0]?.id || '');
      setAccountId(data?.accounts?.[0]?.id || '');
      setActive(true);
      setCurrency('');
      setBaseAmount('');
      initialAmount.current = '';
      currencyTouched.current = false;
    }
    baseTouched.current = false;
    setFormError(null);
  }, [sub, isOpen, data]);

  const selectedAccount = (data?.accounts || []).find(a => a.id === accountId);
  const accountCurrency = selectedAccount?.currency || BASE_CURRENCY;
  const activeCurrency = currency || accountCurrency || BASE_CURRENCY;
  const isForeign = activeCurrency !== BASE_CURRENCY;
  const currencyOptions = orderedCurrencies(accountCurrency);

  // Look up today's rate whenever the currency changes. Silent on failure —
  // no rate simply means no suggested conversion, never a block on saving.
  useEffect(() => {
    let cancelled = false;
    if (!isForeign || !canConvert(activeCurrency)) {
      setRate(null);
      setRateDate(null);
      return undefined;
    }
    setRateLoading(true);
    fetchRate(activeCurrency, BASE_CURRENCY, new Date())
      .then(result => {
        if (cancelled) return;
        setRate(result?.rate ?? null);
        setRateDate(result?.date ?? null);
      })
      .finally(() => { if (!cancelled) setRateLoading(false); });
    return () => { cancelled = true; };
  }, [isForeign, activeCurrency]);

  // Keep the RON total in step with the typed amount — until it's edited by hand.
  useEffect(() => {
    if (!isForeign || baseTouched.current || rate == null) return;
    if (String(amount) === String(initialAmount.current)) return;
    const converted = convert(amount, rate);
    if (converted != null) setBaseAmount(String(converted));
  }, [amount, rate, isForeign]);

  const parsedAmount = parseFloat(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const parsedBase = parseFloat(baseAmount);
  const baseValid = Number.isFinite(parsedBase) && parsedBase > 0;
  const parsedDay = parseInt(dayOfMonth, 10);
  const isYearly = frequency === 'Yearly';
  const parsedMonth = parseInt(monthOfYear, 10);
  const canSubmit = !!name.trim() && amountValid && (!isForeign || baseValid) &&
    Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31 &&
    (!isYearly || (Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12)) &&
    !!categoryId && !!accountId;

  const effectiveRate = isForeign && amountValid && baseValid ? impliedRate(parsedBase, parsedAmount) : null;
  const rateNote = isForeign
    ? formatRateNote(activeCurrency, effectiveRate ?? rate, rateDate, { stale: effectiveRate != null && rate == null })
    : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!canSubmit) {
      if (isForeign && !baseValid) {
        setFormError(`Enter the ${BASE_CURRENCY} amount — no exchange rate was available to work it out automatically.`);
      } else if (isYearly && !(Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12)) {
        setFormError('Pick a month for this yearly subscription.');
      } else {
        setFormError('Fill in every required field with a valid amount and a day between 1 and 31.');
      }
      return;
    }

    setSaving(true);
    const subData = {
      name: name.trim(),
      // RON stays the source of truth, same as a transaction.
      amount: isForeign ? parsedBase : parsedAmount,
      type,
      frequency,
      dayOfMonth: parsedDay,
      monthOfYear: isYearly ? parsedMonth : null,
      categoryId,
      accountId,
      active,
      originalAmount: isForeign ? parsedAmount : null,
      originalCurrency: isForeign ? activeCurrency : '',
    };

    try {
      await onSave(sub ? sub.id : null, subData);
      onClose();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'Could not save this subscription.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} title={sub ? 'Edit Subscription' : 'Add Subscription'} onClose={onClose}>
      {/* 4px row gap, not the usual 6-12px: the currency feature added two
          rows (the currency-aware Amount box, the RON conversion line) that
          tipped this modal into needing a scrollbar on a real phone. */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowX: 'hidden', boxSizing: 'border-box', minWidth: 0 }}>
        <Field label="Name" value={name} onChange={e => setName(e.target.value)} required />

        {/* Amount + currency share one control, same pattern as Add Transaction —
            sometimes this is paid or received in Lei, sometimes in Euro or
            another currency, and the account's own currency is suggested. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <label htmlFor={amountId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
            Amount <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{
            display: 'flex', alignItems: 'stretch', minWidth: 0, height: '44px',
            border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface)', overflow: 'hidden', boxSizing: 'border-box'
          }}>
            <input
              id={amountId} type="number" inputMode="decimal" step="0.01" min="0" required placeholder="0.00"
              className="wiw-no-spinner"
              value={amount} onChange={e => setAmount(e.target.value)}
              style={{
                flex: 1, minWidth: 0, width: '100%', padding: '10px 0 10px 12px',
                border: 'none', outline: 'none', background: 'transparent',
                color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit'
              }}
            />
            <select
              id={currencySelectId}
              aria-label="Currency"
              value={activeCurrency}
              onChange={e => {
                setCurrency(e.target.value);
                currencyTouched.current = true;
                baseTouched.current = false;
                initialAmount.current = null;
              }}
              style={{
                flex: 'none', outline: 'none', background: 'transparent',
                border: 'none', borderLeft: '1px solid var(--color-border-2)',
                color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit',
                padding: '0 0 0 6px', cursor: 'pointer'
              }}
            >
              {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {isForeign && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
              <span style={{ flex: 'none' }}>≈</span>
              <input
                id={baseAmountId}
                aria-label={`Amount in ${BASE_CURRENCY}`}
                type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                className="wiw-no-spinner"
                value={baseAmount}
                onChange={e => { baseTouched.current = true; setBaseAmount(e.target.value); }}
                style={{
                  flex: 'none', width: '84px', padding: '3px 6px',
                  border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface)', color: 'var(--color-ink)',
                  fontSize: 'var(--text-xs)', fontFamily: 'inherit'
                }}
              />
              <span style={{ flex: 'none' }}>L</span>
            </div>
            <div
              title={rateNote || undefined}
              style={{ fontSize: '11px', color: 'var(--color-muted)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {rateLoading
                ? 'Fetching exchange rate…'
                : rateNote
                  ? `Rate: ${rateNote}`
                  : `No rate available for ${activeCurrency} — enter the ${BASE_CURRENCY} amount yourself`}
            </div>
          </div>
        )}

        {/* Type and Repeats share a row on a wide-enough dialog — pairing them
            (like Category/Account below) reclaims a full row of height, which
            fixes a scrollbar the Yearly toggle introduced on laptop viewports
            (~650-700px tall). But neither SegmentedControl compresses (fixed
            options, nowrap text), so forcing a strict 2-up grid clipped
            "Income" and "Yearly" mid-word on a real phone, where the dialog
            itself is only ~295px of content wide — nowhere near the ~170px
            each control actually needs at `size="sm"`. `auto-fit` with a
            minmax matched to that real minimum falls back to one column per
            row (the original, safe layout) below ~425px of dialog width, and
            only pairs them once there's genuinely room. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Type</label>
            <SegmentedControl
              size="sm"
              value={type}
              onChange={val => { setType(val); setCategoryId(''); }}
              options={[
                { value: 'Expense', label: 'Expense' },
                { value: 'Income', label: 'Income' }
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Repeats</label>
            <SegmentedControl
              size="sm"
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: 'Monthly', label: 'Monthly' },
                { value: 'Yearly', label: 'Yearly' }
              ]}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isYearly ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: '6px' }}>
          <Field label="Day of Month (1-31)" type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} required />
          {isYearly && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor={monthSelectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Month</label>
              <select id={monthSelectId} value={monthOfYear} onChange={e => setMonthOfYear(e.target.value)} style={selectStyle}>
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor={categorySelectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Category <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select id={categorySelectId} value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={selectStyle}>
              <option value="">Select…</option>
              {(data?.categories || []).filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor={accountSelectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Account <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select
              id={accountSelectId}
              value={accountId}
              onChange={e => {
                setAccountId(e.target.value);
                // Same rule as the transaction form: a hand-picked currency
                // shouldn't shadow the newly-chosen account's own forever.
                currencyTouched.current = false;
                setCurrency('');
              }}
              required
              style={selectStyle}
            >
              <option value="">Select…</option>
              {(data?.accounts || []).map(a => <option key={a.id} value={a.id}>{formatAccountLabel(a)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input type="checkbox" id={activeCheckboxId} checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor={activeCheckboxId} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>Active (auto-generates transactions)</label>
        </div>

        {formError && (
          <div role="alert" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
            {formError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: '4px' }}>
          {sub && (
            <div style={{ marginRight: 'auto' }}>
              <Button type="button" variant="danger" disabled={saving} onClick={() => setShowConfirmDelete(true)}>Delete</Button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: sub ? 0 : 'auto' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !canSubmit}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Delete Subscription"
        message="Are you sure you want to delete this subscription? It will be archived in Notion and can be restored from the trash there."
        confirmText="Delete"
        variant="danger"
        onConfirm={async () => {
          setShowConfirmDelete(false);
          setSaving(true);
          try {
            await onDelete(sub.id);
            onClose();
          } catch (err) {
            setFormError(err?.message || 'Could not delete this subscription.');
          } finally {
            setSaving(false);
          }
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </Modal>
  );
}
