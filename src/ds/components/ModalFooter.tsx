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
          {/* Both labels always occupy the button, stacked in one grid cell,
              with the inactive one hidden. Swapping the text outright made the
              button change width the instant you pressed it — "Saving..." is
              wider than "Save" — and on a narrow screen (or Android's larger
              text sizes) that extra width was enough to push the footer past
              one line, so Delete jumped onto its own row mid-save. Sizing to
              the wider of the two up front means the row is laid out once and
              never moves, whatever `saveLabel` says. */}
          <span className={styles.saveLabel}>
            <span aria-hidden={isSaving} className={isSaving ? styles.hidden : undefined}>{saveLabel}</span>
            <span aria-hidden={!isSaving} className={isSaving ? undefined : styles.hidden}>Saving...</span>
          </span>
        </Button>
      </div>
    </div>
  );
}
