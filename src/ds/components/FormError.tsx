import styles from './FormError.module.css';

export interface FormErrorProps {
  error?: string | null;
}

export function FormError({ error }: FormErrorProps) {
  if (!error) return null;
  
  return (
    <div role="alert" className={styles.formError}>
      {error}
    </div>
  );
}
