import React, { useId } from 'react';
import fieldStyles from './Field.module.css';

export interface FormFieldProps {
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}

export function FormField({ label, labelRight, hint, error, required, htmlFor, children }: FormFieldProps) {
  const autoId = useId();
  const inputId = htmlFor ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={fieldStyles.field}>
      {label && (
        <label htmlFor={inputId} className={fieldStyles.label}>
          <span>
            {label}
            {required && (
              <span className={fieldStyles.required} aria-hidden>
                {' '}
                *
              </span>
            )}
          </span>
          {labelRight && <span className={fieldStyles.labelRight}>{labelRight}</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={errorId} className={fieldStyles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className={fieldStyles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
