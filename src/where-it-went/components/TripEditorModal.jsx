import { useState, useEffect } from 'react';
import { CURRENCIES } from '../lib/fx';
import { Modal } from '../../ds/components/Modal';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { ConfirmModal } from '../../ds';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { validateTrip } from '../domain/Trip';

export default function TripEditorModal({ isOpen, onClose, trip, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('Planned');
  const [currency, setCurrency] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (trip) {
      setName(trip.name || '');
      setDestination(trip.destination || '');
      // Guard against a stray full timestamp — a <input type="date"> silently
      // blanks itself (and would save `null` over real dates) if fed anything but
      // a plain YYYY-MM-DD.
      setStartDate(trip.startDate ? String(trip.startDate).slice(0, 10) : '');
      setEndDate(trip.endDate ? String(trip.endDate).slice(0, 10) : '');
      setStatus(trip.status || 'Planned');
      setCurrency(trip.currency || '');
      setNotes(trip.notes || '');
    } else {
      setName('');
      setDestination('');
      setStartDate('');
      setEndDate('');
      setStatus('Planned');
      setCurrency('');
      setNotes('');
    }
    setFormError(null);
  }, [trip, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const tripData = {
      name: name.trim(),
      destination: destination.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      status,
      currency,
      notes: notes.trim()
    };

    const { valid, errors } = validateTrip(tripData);
    if (!valid) {
      setFormError(errors.join(' '));
      return;
    }

    setSaving(true);
    try {
      await onSave(trip ? trip.id : null, tripData);
      onClose();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'Could not save this trip.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} title={trip ? 'Edit Trip' : 'Add Trip'} onClose={onClose}>
      {/* 8px row gap and no extra margin above the buttons — with Currency
          added this form gained a row, and the modal has to stay scroll-free on
          a laptop as well as a phone. */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Field label="Trip Name" placeholder="e.g. Billund 2025" value={name} onChange={e => setName(e.target.value)} required />
        <Field label="Destination" placeholder="e.g. Billund, Denmark" value={destination} onChange={e => setDestination(e.target.value)} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
          <Field label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Field label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined} />
        </div>

        {/* Status and Currency share a row. Both are short controls, and
            stacking them cost a whole row of height the modal couldn't spare.
            `minmax(0, …)` so neither can refuse to shrink — a bare `fr` floors
            at the content's min-content width and overflows. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-sm)', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Status</label>
            <SegmentedControl
              value={status}
              onChange={val => setStatus(val)}
              options={[
                { value: 'Planned', label: 'Planned' },
                { value: 'Active', label: 'Active' },
                { value: 'Completed', label: 'Completed' }
              ]}
            />
          </div>

          {/* Sets the default currency for anything tagged to this trip — on a
              trip you spend the destination's money, whatever card settles it. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <label htmlFor="trip-currency" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
              Currency
            </label>
            <select
              id="trip-currency"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit'
              }}
            >
              <option value="">Account&apos;s</option>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <Field label="Notes" placeholder="Optional trip notes..." value={notes} onChange={e => setNotes(e.target.value)} />

        {formError && (
          <div role="alert" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
            {formError}
          </div>
        )}

        <div className="tx-form-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
          {trip && (
            <div style={{ marginRight: 'auto' }}>
              <Button type="button" variant="danger" disabled={saving} onClick={() => setShowConfirmDelete(true)}>Delete</Button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: trip ? 0 : 'auto' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Delete Trip"
        message="Are you sure you want to delete this trip? It will be archived in Notion and can be restored from the trash there."
        confirmText="Delete"
        variant="danger"
        onConfirm={async () => {
          setShowConfirmDelete(false);
          setSaving(true);
          try {
            await onDelete(trip.id);
            onClose();
          } catch (err) {
            setFormError(err?.message || 'Could not delete this trip.');
          } finally {
            setSaving(false);
          }
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </Modal>
  );
}
