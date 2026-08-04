import React, { useState, useId, useEffect } from "react";
import { Modal } from "../../ds/components/Modal";
import { Field } from "../../ds/components/Field";
import { CategorySelect } from "./CategorySelect";
import { FormError } from "../../ds/components/FormError";
import { ModalFooter } from "../../ds/components/ModalFooter";
import { formatCurrency } from "../lib/currency";

const QUICK_PCTS = [10, 25, 33, 50, 67, 75, 90];

export default function SplitTransactionModal({ isOpen, onClose, transaction, categories = [], onSave }) {
  const [mode, setMode] = useState("amount"); // "amount" | "percent"
  const [splitAmount, setSplitAmount] = useState("");
  const [splitPct, setSplitPct] = useState("");
  const [splitCategoryId, setSplitCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const categorySelectId = useId();

  // The modal is always mounted (App.jsx toggles it with `isOpen`, not by
  // unmounting), so without this every field kept whatever a *previous*
  // transaction's split left behind — mode, amount, category and all.
  useEffect(() => {
    if (!isOpen) return;
    setMode("amount");
    setSplitAmount("");
    setSplitPct("");
    setSplitCategoryId("");
    setFormError("");
  }, [isOpen, transaction?.id]);

  if (!transaction) return null;

  const isIncome = transaction.type === "Income";
  const numOriginal = Number(transaction.amount) || 0;

  // Derive the active split amount from whichever mode is active.
  const numSplit = mode === "percent"
    ? Math.round((Number(splitPct) / 100) * numOriginal * 100) / 100
    : Number(splitAmount) || 0;

  // Round the split once, then derive the remainder from *that* rounded value
  // — never round both sides independently. Splitting 101 at 33% used to ceil
  // both halves (34 + 68 = 102), quietly inventing a leu on every non-integer
  // split.
  const roundedSplit = Math.max(0, Math.ceil(numSplit));
  const roundedOriginal = Math.round(numOriginal);
  const remainderAmount = isIncome ? roundedOriginal + roundedSplit : roundedOriginal - roundedSplit;

  let splitOriginalAmount = null;
  let remainderOriginalAmount = null;
  if (transaction.originalCurrency && transaction.originalAmount && numOriginal > 0) {
    const ratio = numSplit / numOriginal;
    splitOriginalAmount = Math.ceil(transaction.originalAmount * ratio);
    // Mirrors the RON side: an income split grosses the remainder back up by
    // the carved-out amount rather than leaving it frozen at the original
    // figure, which used to imply a different exchange rate on the surviving
    // row than the one actually used.
    remainderOriginalAmount = isIncome
      ? transaction.originalAmount + splitOriginalAmount
      : transaction.originalAmount - splitOriginalAmount;
  }

  // Validity is checked against the *rounded* split — a 99.5 split of 100
  // reads as valid pre-rounding but rounds to 100, which would zero out (or
  // invert) the remainder once actually saved.
  const isInvalid = !isIncome && (roundedSplit >= roundedOriginal || roundedSplit <= 0);
  const isIncomeInvalid = isIncome && roundedSplit <= 0;

  const hasValue = mode === "percent" ? splitPct !== "" : splitAmount !== "";
  const canSubmit = hasValue && splitCategoryId && !(isIncome ? isIncomeInvalid : isInvalid);

  const splitCategoryType = isIncome ? "Expense" : transaction.type;
  const filteredCategories = categories
    .filter(c => c.type === splitCategoryType)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      if (!hasValue) setFormError("Enter a split amount or percentage.");
      else if (!splitCategoryId) setFormError("Choose a category for the split.");
      else if (isIncome ? isIncomeInvalid : isInvalid) {
        setFormError(isIncome
          ? "Enter a split amount greater than zero."
          : "Split amount must be greater than zero and less than the total expense.");
      }
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await onSave({
        originalTx: transaction,
        splitAmount: roundedSplit,
        remainderAmount,
        splitOriginalAmount,
        remainderOriginalAmount,
        splitCategoryId
      });
      onClose();
    } catch (err) {
      setFormError(err?.message || "Could not save split. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStyle = (active) => ({
    flex: 1,
    padding: "6px 0",
    fontSize: "var(--text-sm)",
    fontWeight: active ? "var(--weight-bold)" : "var(--weight-regular)",
    borderRadius: "var(--radius-sm)",
    border: "none",
    cursor: "pointer",
    transition: "all 0.18s",
    backgroundColor: active ? "var(--color-accent)" : "transparent",
    color: active ? "#fff" : "var(--color-muted)",
  });

  const chipStyle = (active) => ({
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-medium)",
    cursor: "pointer",
    border: "1px solid",
    transition: "all 0.15s",
    backgroundColor: active
      ? "color-mix(in srgb, var(--color-accent) 18%, transparent)"
      : "transparent",
    borderColor: active ? "var(--color-accent)" : "var(--color-border)",
    color: active ? "var(--color-accent)" : "var(--color-muted)",
  });

  return (
    <Modal open={isOpen} onClose={onClose} title="Split Transaction">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", boxSizing: "border-box", minWidth: 0 }}>

        {/* Original transaction summary */}
        <div style={{ padding: "12px", backgroundColor: "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
            Original Transaction ({isIncome ? "Net Income" : "Total Expense"})
          </div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-bold)", color: "var(--color-ink)" }}>
            {transaction.description} &middot; {formatCurrency(numOriginal)}{transaction.originalCurrency ? ` (${transaction.originalAmount} ${transaction.originalCurrency})` : ""}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "2px", backgroundColor: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", padding: "3px", border: "1px solid var(--color-border)" }}>
          <button type="button" style={toggleStyle(mode === "amount")} onClick={() => setMode("amount")}>
            Amount (RON)
          </button>
          <button type="button" style={toggleStyle(mode === "percent")} onClick={() => setMode("percent")}>
            Percentage %
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {mode === "amount" ? (
            <Field
              label={isIncome ? "Embedded Expense Amount (RON)" : "Split Amount (RON)"}
              type="number"
              step="1"
              min="1"
              max={isIncome ? undefined : Math.max(1, numOriginal - 1)}
              value={splitAmount}
              onChange={e => setSplitAmount(e.target.value)}
              placeholder="Enter split amount"
              required
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Quick-select chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {QUICK_PCTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    style={chipStyle(Number(splitPct) === p)}
                    onClick={() => setSplitPct(String(p))}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              {/* Custom % input */}
              <Field
                label="Custom %"
                type="number"
                step="1"
                min="1"
                max="99"
                value={splitPct}
                onChange={e => setSplitPct(e.target.value)}
                placeholder="e.g. 40"
              />
              {splitPct !== "" && !isNaN(Number(splitPct)) && Number(splitPct) > 0 && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                  {splitPct}% of {formatCurrency(numOriginal)} = <strong>{formatCurrency(roundedSplit)}</strong>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
            <CategorySelect id={categorySelectId} value={splitCategoryId} onChange={e => setSplitCategoryId(e.target.value)} required label="Split Category" categories={filteredCategories} />
          </div>
        </div>

        {/* Result preview */}
        {hasValue && !isNaN(numSplit) && numSplit > 0 && (
          <div style={{ padding: "12px", backgroundColor: isInvalid ? "color-mix(in srgb, var(--color-danger) 10%, transparent)" : "color-mix(in srgb, var(--color-success) 10%, transparent)", borderRadius: "var(--radius-md)", border: `1px solid ${isInvalid ? "var(--color-danger)" : "var(--color-success)"}` }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)", color: "var(--color-ink)", marginBottom: "4px" }}>
              Resulting Transactions:
            </div>
            <ul style={{ fontSize: "var(--text-sm)", color: "var(--color-ink)", margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>
                {isIncome ? "Gross Income" : "Remainder"}: <strong>{formatCurrency(remainderAmount)}</strong> {remainderOriginalAmount && `(approx. ${remainderOriginalAmount} ${transaction.originalCurrency})`} (stays in {categories.find(c => c.id === transaction.categoryId)?.name || "original category"})
              </li>
              <li>
                New Split: <strong>{formatCurrency(roundedSplit)}</strong> {splitOriginalAmount && `(approx. ${splitOriginalAmount} ${transaction.originalCurrency})`} (goes to selected category)
              </li>
            </ul>
            {isInvalid && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", marginTop: "8px" }}>
                Split amount cannot be greater than or equal to the total expense.
              </div>
            )}
          </div>
        )}

        <FormError error={formError} />

        <ModalFooter
          onCancel={onClose}
          isSaving={saving}
          saveLabel="Save Split"
        />
      </form>
    </Modal>
  );
}
