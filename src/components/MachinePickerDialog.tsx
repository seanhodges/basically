// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useRef } from 'react';
import { useDismiss } from '../app/useDismiss';
import { dialects } from '../dialects/registry';
import { MachineArt } from './machineArt';
import {
  groupMachinesByManufacturer,
  machineChoiceLabel,
} from './machinePicker';
import dialog from './Dialog.module.css';
import styles from './MachinePickerDialog.module.css';

const groups = groupMachinesByManufacturer(dialects);

/**
 * The machine list, grouped by manufacturer and illustrated - the one place a
 * target machine is chosen, whether that is while starting a project or while
 * switching the machine of the program already open.
 *
 * Deliberately controlled and store-free: the New-project dialog points it at
 * its own local choice, while the toolbar points it at `setDialect`. Keeping
 * the store out is what lets one component serve both without either caller's
 * semantics leaking into the other.
 */
export function MachinePickerDialog({
  open,
  selectedId,
  onChoose,
  onDismiss,
}: {
  open: boolean;
  selectedId: string;
  onChoose: (id: string) => void;
  onDismiss: () => void;
}) {
  const ref = useDismiss<HTMLDivElement>(open, onDismiss);
  const listRef = useRef<HTMLDivElement>(null);

  // Open on the current machine, so the keyboard starts where the eye does.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`${dialog.modalBackdrop} ${styles.backdrop}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="machine-picker-title"
    >
      <div ref={ref} className={`${dialog.modal} ${styles.panel}`}>
        <h2 id="machine-picker-title">Choose a machine</h2>

        <div ref={listRef} className={styles.groups}>
          {groups.map((group) => (
            <div key={group.manufacturer} className={styles.group}>
              <h3 className={styles.groupName}>{group.manufacturer}</h3>
              {group.machines.map((d) => (
                <button
                  key={d.id}
                  // `type="button"`: in the New-project dialog this list is
                  // rendered inside the form, where a bare button submits.
                  type="button"
                  // Stable hook for tests: machine names prefix one another
                  // ("Spectrum" / "Spectrum 128"), so text is ambiguous.
                  data-machine={d.id}
                  className={`${styles.machine} ${d.id === selectedId ? styles.machineOn : ''}`}
                  aria-pressed={d.id === selectedId}
                  aria-label={machineChoiceLabel(d)}
                  onClick={() => onChoose(d.id)}
                >
                  <span className={styles.art}>
                    <MachineArt id={d.id} size={32} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.machineName}>
                      {d.name}
                      <span className={styles.machineYear}>{d.year}</span>
                    </span>
                    <span className={styles.blurb}>{d.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className={dialog.modalActions}>
          <button type="button" onClick={onDismiss}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
