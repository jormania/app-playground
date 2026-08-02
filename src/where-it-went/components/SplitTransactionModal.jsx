import React, { useState, useId } from "react";
import { Modal } from "../../ds/components/Modal";
import { Field } from "../../ds/components/Field";
import { Button } from "../../ds/components/Button";
import { CategorySelect } from "./CategorySelect";
import { FormError } from "../../ds/components/FormError";
import { ModalFooter } from "../../ds/components/ModalFooter";



export default function SplitTransactionModal({ isOpen, onClose, transaction, categories = [], onSave }) {
  const [splitAmount, setSplitAmount] = useState("");
  const [splitCategoryId, setSplitCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const categorySelectId = useId();

  if (!transaction) return null;

  const isIncome = transaction.type === "Income";
  const numOriginal = Number(transaction.amount) || 0;
  
  // The user inputs a split amount in the base currency (RON).
  const numSplit = Number(splitAmount) || 0;

  // The math:
  // For Expense: Total is original. Remainder = original - split.
  // For Income: The original was NET. The new split is an EXPENSE. So Gross Income = Net + Expense.
  let remainderAmount = 0;
  if (isIncome) {
    remainderAmount = numOriginal + numSplit;
  } else {
    remainderAmount = numOriginal - numSplit;
  }

  let splitOriginalAmount = null;
  let remainderOriginalAmount = null;
  if (transaction.originalCurrency && transaction.originalAmount) {
    const ratio = numSplit / numOriginal;
    splitOriginalAmount = Math.ceil(transaction.originalAmount * ratio);
    if (isIncome) {
      remainderOriginalAmount = transaction.originalAmount;
    } else {
      remainderOriginalAmount = transaction.originalAmount - splitOriginalAmount;
    }
  }

  // Prevent invalid splits
  // Expense splits cannot be more than the total (remainder < 0).
  // Splits must be positive.
  const isInvalid = !isIncome && (numSplit >= numOriginal || numSplit <= 0);
  const isIncomeInvalid = isIncome && numSplit <= 0;

  const canSubmit = splitAmount !== "" && splitCategoryId && !(isIncome ? isIncomeInvalid : isInvalid);

  const splitCategoryType = isIncome ? "Expense" : transaction.type;
  
  const filteredCategories = categories
    .filter(c => c.type === splitCategoryType)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setFormError("");
    try {
      // Pass the rounded/computed amounts back to App.jsx to orchestrate Notion logic.
      await onSave({
        originalTx: transaction,
        splitAmount: Math.ceil(numSplit),
        remainderAmount: Math.ceil(remainderAmount),
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

  return (
    <Modal open={isOpen} onClose={onClose} title="Split Transaction">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", boxSizing: "border-box", minWidth: 0 }}>
        
        <div style={{ padding: "12px", backgroundColor: "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
            Original Transaction ({isIncome ? "Net Income" : "Total Expense"})
          </div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-bold)", color: "var(--color-ink)" }}>
            {transaction.description} &middot; {numOriginal} {transaction.originalCurrency ? `RON (${transaction.originalAmount} ${transaction.originalCurrency})` : "RON"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
            <CategorySelect id={categorySelectId} value={splitCategoryId} onChange={e => setSplitCategoryId(e.target.value)} required label="Split Category" categories={filteredCategories} />
          </div>
        </div>

        {splitAmount !== "" && !isNaN(numSplit) && numSplit > 0 && (
          <div style={{ padding: "12px", backgroundColor: isInvalid ? "color-mix(in srgb, var(--color-danger) 10%, transparent)" : "color-mix(in srgb, var(--color-success) 10%, transparent)", borderRadius: "var(--radius-md)", border: `1px solid ${isInvalid ? "var(--color-danger)" : "var(--color-success)"}` }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)", color: "var(--color-ink)", marginBottom: "4px" }}>
              Resulting Transactions:
            </div>
            <ul style={{ fontSize: "var(--text-sm)", color: "var(--color-ink)", margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>
                {isIncome ? "Gross Income" : "Remainder"}: <strong>{Math.ceil(remainderAmount)}</strong> {remainderOriginalAmount && `(approx. ${remainderOriginalAmount} ${transaction.originalCurrency})`} (stays in {categories.find(c => c.id === transaction.categoryId)?.name || "original category"})
              </li>
              <li>
                New Split: <strong>{Math.ceil(numSplit)}</strong> {splitOriginalAmount && `(approx. ${splitOriginalAmount} ${transaction.originalCurrency})`} (goes to selected category)
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
