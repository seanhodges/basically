import { useBlocks, useIdeStore } from '../app/store';
import { blocksSurviveSwitch } from '../app/blockRetention';
import { useDataBlocks } from '../app/dataBlocks';
import { getDialect } from '../dialects/registry';
import dialog from './Dialog.module.css';

/**
 * Asks the user how to handle their code when switching the target machine.
 * Shown only when the editor holds the user's own code (a pristine starter or
 * sample is swapped automatically; see store.setDialect).
 *
 * Keeping the code keeps the workbench that came with it, so the question says
 * what travels and what does not - each line only where the document actually
 * holds that thing, and the one about blocks decided by the same rule the
 * switch will apply.
 */
export function SwitchTargetDialog() {
  const pendingDialectId = useIdeStore((s) => s.pendingDialectId);
  const dialect = useIdeStore((s) => s.dialect);
  const scratchBuffers = useIdeStore((s) => s.scratchBuffers);
  const confirmDialectSwitch = useIdeStore((s) => s.confirmDialectSwitch);
  const cancelDialectSwitch = useIdeStore((s) => s.cancelDialectSwitch);
  const blocks = useBlocks();
  const dataBlocks = useDataBlocks();

  if (pendingDialectId === null) return null;

  const next = getDialect(pendingDialectId);
  const name = next.name;
  const keepsBlocks = blocksSurviveSwitch(dialect, next);

  return (
    <div className={dialog.modalBackdrop} onClick={cancelDialectSwitch}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Switch to {name}?</h2>
        <p>You have code in the editor.</p>
        <p className={dialog.modalWarning}>
          Keeping your code may not run on {name} - its BASIC dialect differs.
        </p>
        {blocks.length > 0 && keepsBlocks && (
          <p className={dialog.modalNote}>
            Your memory blocks come with it, at the addresses they have now -
            which {name} may not allow there.
          </p>
        )}
        {blocks.length > 0 && !keepsBlocks && (
          <p className={dialog.modalNote}>
            {next.memoryBlocks
              ? `${name} keeps machine code in a different place, so this program's memory blocks are dropped.`
              : `${name} has no memory blocks, so this program's are dropped.`}
          </p>
        )}
        {scratchBuffers.length > 0 && (
          <p className={dialog.modalNote}>Your scratch buffers come too.</p>
        )}
        {dataBlocks.length > 0 && (
          <p className={dialog.modalNote}>
            The files your program saved are discarded - they belong to{' '}
            {dialect.name}.
          </p>
        )}
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
