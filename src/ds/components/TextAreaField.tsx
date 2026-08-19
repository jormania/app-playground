import React, { forwardRef, useId } from 'react';
import { cx } from '../lib/cx';
import fieldStyles from './Field.module.css';
import { FormField } from './FormField';

export interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}

/** The multi-line counterpart to `Field`. Same label/hint/error furniture via
 *  `FormField`, same input skin — but a real `<textarea>`, so prose that is
 *  genuinely multi-line (a passage, a note, a reason) is edited at the size it
 *  actually is rather than scrolling sideways through a 44px-tall input. */
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, labelRight, hint, error, required, id, className, rows = 4, ...props }, ref) => {
    const autoId = useId();
    const areaId = id ?? autoId;
    const hintId = hint ? `${areaId}-hint` : undefined;
    const errorId = error ? `${areaId}-error` : undefined;

    return (
      <FormField label={label} labelRight={labelRight} hint={hint} error={error} required={required} htmlFor={areaId}>
        <textarea
          ref={ref}
          id={areaId}
          rows={rows}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hintId}
          className={cx(fieldStyles.input, fieldStyles.textarea, error && fieldStyles.inputError, className)}
          {...props}
        />
      </FormField>
    );
  }
);
TextAreaField.displayName = 'TextAreaField';
