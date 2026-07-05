import { useEffect, useState } from 'react';
import type { MachineEmulator, MachineVariable } from '../dialects/types';
import styles from './VariableWatcher.module.css';
import dialog from './Dialog.module.css';

interface Props {
  /** Accessor for the live emulator (null until a program has been run). */
  getMachine: () => MachineEmulator | null;
  /** Whether the emulator is currently running. */
  running: boolean;
  /** Whether the emulator is paused at a breakpoint / single step. */
  paused: boolean;
}

/** Poll interval for refreshing variable values (ms). ~6–7Hz reads cheaply. */
const POLL_MS = 150;

const KIND_LABELS: Record<MachineVariable['kind'], string> = {
  number: 'number',
  string: 'string',
  'number-array': 'num array',
  'string-array': 'str array',
};

/**
 * Read-only live view of the running program's BASIC variables. Polls the
 * emulator a few times a second rather than every frame — imperceptible lag
 * for a debug panel, and it keeps a large table from re-rendering at 50Hz.
 *
 * Each value is a button that opens a detail modal showing the variable's name,
 * type and full value — a snapshot taken at click time, not refreshed by later
 * polls, so the modal stays stable (and survives the program stopping).
 */
export function VariableWatcher({ getMachine, running, paused }: Props) {
  const [vars, setVars] = useState<MachineVariable[]>([]);
  const [selected, setSelected] = useState<MachineVariable | null>(null);

  useEffect(() => {
    if (!running && !paused) {
      setVars([]);
      return;
    }
    const read = () => {
      const machine = getMachine();
      setVars(machine?.readVariables ? machine.readVariables() : []);
    };
    read();
    // Paused execution holds memory steady, so a single read suffices — the
    // values shown are those from the last frame before the pause; no poll.
    if (paused) return;
    const id = setInterval(read, POLL_MS);
    return () => clearInterval(id);
  }, [running, paused, getMachine]);

  // A machine only exists once a program has run; only then can we tell whether
  // this machine supports introspection. The per-branch content is assigned to a
  // variable (rather than early-returned) so the detail modal, appended after it
  // in a single return, survives the program stopping while it is open — which
  // flips `running` false and empties `vars`, hitting the "not running" branch.
  const machine = getMachine();
  let content;
  if (machine && typeof machine.readVariables !== 'function') {
    content = (
      <div className={styles.watcherEmpty}>
        Variable watching isn’t available for this machine yet.
      </div>
    );
  } else if (!running && !paused) {
    content = (
      <div className={styles.watcherEmpty}>
        Run a program to inspect its variables.
      </div>
    );
  } else if (vars.length === 0) {
    content = (
      <div className={styles.watcherEmpty}>No variables defined yet.</div>
    );
  } else {
    content = (
      <table className={styles.watcherTable}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {vars.map((v) => (
            <tr key={v.name}>
              <td className={styles.watcherName}>{v.name}</td>
              <td className={styles.watcherKind}>{KIND_LABELS[v.kind]}</td>
              <td className={styles.watcherValue}>
                <button
                  type="button"
                  className={styles.watcherValueText}
                  onClick={() => setSelected(v)}
                >
                  {v.value}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      {content}
      {selected && (
        <div className={dialog.modalBackdrop} onClick={() => setSelected(null)}>
          <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{selected.name}</h2>
            <p>{KIND_LABELS[selected.kind]}</p>
            <div className={styles.modalValue}>{selected.value}</div>
            <div className={dialog.modalActions}>
              <button onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
