import React, { forwardRef } from 'react';
import { cx } from '../lib/cx';
import fieldStyles from './Field.module.css';
import { FormField, FormFieldProps } from './FormField';

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, labelRight, hint, error, required, id, className, children, ...props }, ref) => {
    return (
      <FormField label={label} labelRight={labelRight} hint={hint} error={error} required={required} htmlFor={id}>
        <select
          ref={ref}
          id={id}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
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

