import { useState, useEffect } from 'react';
import { CURRENCIES } from '../lib/fx';
import { Modal } from '../../ds/components/Modal';
import { Field } from '../../ds/components/Field';
import { ConfirmModal } from '../../ds';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { FormError } from '../../ds/components/FormError';
import { ModalFooter } from '../../ds/components/ModalFooter';
import { SelectField } from '../../ds/components/SelectField';
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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowX: 'hidden', boxSizing: 'border-box', minWidth: 0 }}>
        <Field label="Trip Name" placeholder="e.g. Billund 2025" value={name} onChange={e => setName(e.target.value)} required />
        {/* Currency sits beside Destination, not beside Status: the Status
            control has three fixed-width segments and will not shrink, so
            pairing it with anything made the two overlap on a phone. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-sm)', alignItems: 'end' }}>
          <Field label="Destination" placeholder="e.g. Billund, Denmark" value={destination} onChange={e => setDestination(e.target.value)} />
          <SelectField label="Currency" id="trip-currency" value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="">None</option>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectField>
        </div>

        {/* `minmax(0, 1fr)`, not a bare `1fr`: a date input's intrinsic width is
            wide, and a plain `fr` track refuses to shrink below it — which is
            what pushed End Date off the right edge on a phone. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-sm)' }}>
          <Field label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Field label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined} />
        </div>

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

        <Field label="Notes" placeholder="Optional trip notes..." value={notes} onChange={e => setNotes(e.target.value)} />

        <FormError error={formError} />

        <ModalFooter
          onCancel={onClose}
          onDelete={trip && onDelete ? () => setShowConfirmDelete(true) : undefined}
          isSaving={saving}
        />
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
