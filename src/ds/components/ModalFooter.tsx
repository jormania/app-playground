import { Button } from './Button';
import styles from './ModalFooter.module.css';

export interface ModalFooterProps {
  onCancel: () => void;
  onSave?: () => void; // Optional if you are using type="submit" on a form
  onDelete?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  deleteLabel?: string;
}

export function ModalFooter({
  onCancel,
  onSave,
  onDelete,
  isSaving = false,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  deleteLabel = 'Delete'
}: ModalFooterProps) {
  return (
    <div className={styles.footer}>
      {onDelete && (
        <div className={styles.left}>
          <Button type="button" variant="danger" disabled={isSaving} onClick={onDelete}>
            {deleteLabel}
          </Button>
        </div>
      )}
      <div className={styles.right}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          {cancelLabel}
        </Button>
        <Button type={onSave ? "button" : "submit"} variant="primary" disabled={isSaving} onClick={onSave}>
          {isSaving ? 'Saving...' : saveLabel}
        </Button>
      </div>
    </div>
  );
}
