import { useEffect, useState } from 'react';
import type { MachineEmulator, MachineVariable } from '../dialects/types';
import styles from './VariableWatcher.module.css';

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
 * The value is rendered inside a dedicated span so a future "edit at runtime"
 * mode can swap it for an input without restructuring the row.
 */
export function VariableWatcher({ getMachine, running, paused }: Props) {
  const [vars, setVars] = useState<MachineVariable[]>([]);

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
  // this machine supports introspection.
  const machine = getMachine();
  if (machine && typeof machine.readVariables !== 'function') {
    return (
      <div className={styles.watcherEmpty}>
        Variable watching isn’t available for this machine yet.
      </div>
    );
  }
  if (!running && !paused) {
    return (
      <div className={styles.watcherEmpty}>
        Run a program to inspect its variables.
      </div>
    );
  }
  if (vars.length === 0) {
    return <div className={styles.watcherEmpty}>No variables defined yet.</div>;
  }

  return (
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
              <span className={styles.watcherValueText}>{v.value}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
