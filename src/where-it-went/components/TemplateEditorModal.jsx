import React, { useState, useId } from "react";
import { Modal } from "../../ds/components/Modal";
import { Field } from "../../ds/components/Field";
import { Button } from "../../ds/components/Button";
import { ConfirmModal } from "../../ds";
import { SegmentedControl } from "../../ds/components/SegmentedControl";
import { formatAccountLabel } from "../lib/accounts";

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border-2)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-ink)",
  fontSize: "var(--text-base)",
  fontFamily: "inherit"
};

export default function TemplateEditorModal({ isOpen, onClose, template, categories = [], accounts = [], onSave, onDelete }) {
  const [description, setDescription] = useState(template?.description || "");
  const [amount, setAmount] = useState(template?.amount || "");
  const [type, setType] = useState(template?.type || "Expense");
  const [categoryId, setCategoryId] = useState(template?.categoryId || "");
  const [accountId, setAccountId] = useState(template?.accountId || accounts[0]?.id || "");
  const [active, setActive] = useState(template?.active !== false);
  const [saving, setSaving] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [formError, setFormError] = useState("");

  const categorySelectId = useId();
  const accountSelectId = useId();

  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  const availableCategories = categories
    .filter(c => c.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedCat = categories.find(c => c.id === categoryId);

  const canSubmit = !!description.trim() && !!categoryId && !!accountId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setFormError("");
    try {
      await onSave({
        id: template?.id,
        description,
        amount: amount === "" ? null : amount,
        type,
        categoryId,
        accountId,
        active
      });
      onClose();
    } catch (err) {
      setFormError(err?.message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={template ? "Edit Template" : "New Template"}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px", boxSizing: "border-box", minWidth: 0, padding: "0 3px" }}>
        <SegmentedControl
          options={[{ value: "Expense", label: "Expense" }, { value: "Income", label: "Income" }]}
          value={type}
          onChange={(val) => {
            setType(val);
            setCategoryId("");
          }}
        />
        
        <Field 
          label="Description" 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          required 
          placeholder="e.g. Coffee" 
        />
        
        <Field 
          label="Amount" 
          type="number" 
          step="0.01" 
          min="0"
          value={amount} 
          onChange={e => setAmount(e.target.value)} 
          placeholder="Leave blank to enter when clicking"
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: "var(--space-sm)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
            <label htmlFor={categorySelectId} style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-ink)" }}>
              Category <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <select id={categorySelectId} value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={selectStyle}>
              <option value="" disabled>Select…</option>
              {availableCategories.map(c => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
              ))}
            </select>
            {selectedCat?.description && (
              <details style={{ marginTop: "2px" }}>
                <summary style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", cursor: "pointer", userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "10px" }}>▶</span> Category description
                </summary>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", marginTop: "4px", fontStyle: "italic", lineHeight: "1.4", paddingLeft: "14px" }}>
                  {selectedCat.description}
                </div>
              </details>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
            <label htmlFor={accountSelectId} style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-ink)" }}>
              Account <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <select id={accountSelectId} value={accountId} onChange={e => setAccountId(e.target.value)} required style={selectStyle}>
              {sortedAccounts.map(a => (
                <option key={a.id} value={a.id}>{formatAccountLabel(a)}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginTop: "4px" }}>
          <input type="checkbox" id="template-active-checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor="template-active-checkbox" style={{ fontSize: "var(--text-sm)", color: "var(--color-ink)", userSelect: "none" }}>Active (shows on Dashboard)</label>
        </div>

        {formError && (
          <div role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", backgroundColor: "color-mix(in srgb, var(--color-danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)", padding: "var(--space-sm)", borderRadius: "var(--radius-sm)" }}>
            {formError}
          </div>
        )}

        <div className="tx-form-actions" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginTop: "4px" }}>
          {template && onDelete && (
            <div style={{ marginRight: "auto" }}>
              <Button type="button" variant="danger" disabled={saving} onClick={() => setShowConfirmDelete(true)}>Delete</Button>
            </div>
          )}
          <div style={{ display: "flex", gap: "var(--space-sm)", marginLeft: (template && onDelete) ? 0 : "auto" }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !canSubmit}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>

        <ConfirmModal
          isOpen={showConfirmDelete}
          title="Delete Template"
          message="Are you sure you want to delete this template?"
          confirmText="Delete"
          variant="danger"
          onConfirm={async () => {
            setShowConfirmDelete(false);
            setSaving(true);
            try {
              await onDelete(template.id);
            } catch (err) {
              setFormError(err?.message || "Could not delete this template.");
            } finally {
              setSaving(false);
            }
          }}
          onCancel={() => setShowConfirmDelete(false)}
        />
      </form>
    </Modal>
  );
}
