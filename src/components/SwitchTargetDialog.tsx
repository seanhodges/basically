import { useIdeStore } from '../app/store';
import { getDialect } from '../dialects/registry';
import dialog from './Dialog.module.css';

/**
 * Asks the user how to handle their code when switching the target machine.
 * Shown only when the editor holds the user's own code (a pristine starter or
 * sample is swapped automatically; see store.setDialect).
 */
export function SwitchTargetDialog() {
  const pendingDialectId = useIdeStore((s) => s.pendingDialectId);
  const confirmDialectSwitch = useIdeStore((s) => s.confirmDialectSwitch);
  const cancelDialectSwitch = useIdeStore((s) => s.cancelDialectSwitch);

  if (pendingDialectId === null) return null;

  const name = getDialect(pendingDialectId).name;

  return (
    <div className={dialog.modalBackdrop} onClick={cancelDialectSwitch}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Switch to {name}?</h2>
        <p>
          You have code in the editor. What would you like to do when switching
          to {name}?
        </p>
        <p className={dialog.modalWarning}>
          Keeping your code may not run on {name} — its BASIC dialect differs.
        </p>
        <div className={dialog.modalActions}>
          <button onClick={cancelDialectSwitch}>Cancel</button>
          <button onClick={() => confirmDialectSwitch('keep')}>
            Keep my code
          </button>
          <button onClick={() => confirmDialectSwitch('new')}>Start new</button>
        </div>
      </div>
    </div>
  );
}
