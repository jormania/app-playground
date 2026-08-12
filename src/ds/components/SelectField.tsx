import React, { forwardRef, useId } from 'react';
import { cx } from '../lib/cx';
import fieldStyles from './Field.module.css';
import { FormField } from './FormField';

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, labelRight, hint, error, required, id, className, children, ...props }, ref) => {
    // Field.tsx has always done this; SelectField didn't, so when a caller omitted `id`
    // the select rendered id={undefined} while FormField generated its own id for the
    // label's htmlFor. The two never met and the select had no accessible name.
    const autoId = useId();
    const selectId = id ?? autoId;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;

    return (
      <FormField label={label} labelRight={labelRight} hint={hint} error={error} required={required} htmlFor={selectId}>
        <select
          ref={ref}
          id={selectId}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hintId}
          className={cx(fieldStyles.input, error && fieldStyles.inputError, className)}
          {...props}
        >
          {children}
        </select>
      </FormField>
    );
  }
);
SelectField.displayName = 'SelectField';

