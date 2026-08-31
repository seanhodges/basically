// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useMemo, useRef } from 'react';
import { useDismiss } from '../app/useDismiss';
import { MachineArt } from './machineArt';
import {
  MACHINE_SORTS,
  filterMachines,
  groupMachines,
  machineChoiceLabel,
  type MachineLike,
  type MachineSort,
} from './machinePicker';
import dialog from './Dialog.module.css';
import styles from './MachinePickerDialog.module.css';

/**
 * The machine list, searchable, arrangeable and illustrated - the one place a
 * machine is chosen, whether that is while starting a project, while switching
 * the machine of the program already open, or while choosing the two ends of a
 * port in the docs' porting guide.
 *
 * Deliberately controlled, store-free and registry-free: the New-project dialog
 * points it at its own local choice, the toolbar points it at `setDialect`, and
 * the porting guide points it at a list the docs own. The search text and the
 * arrangement are props for the same reason the selected machine is - the IDE
 * keeps them in its store so its two pickers agree and a reload restores them,
 * and the guide keeps them in local state and persists nothing.
 *
 * Taking the machines as a prop rather than reading the registry is what lets it
 * render outside the app at all - the registry imports every dialect index, and
 * each pulls in an emulator core.
 */
export function MachinePickerDialog({
  open,
  machines,
  selectedId,
  query,
  sort,
  onQueryChange,
  onSortChange,
  onChoose,
  onDismiss,
}: {
  open: boolean;
  machines: readonly MachineLike[];
  selectedId: string;
  query: string;
  sort: MachineSort;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: MachineSort) => void;
  onChoose: (id: string) => void;
  onDismiss: () => void;
}) {
  const ref = useDismiss<HTMLDivElement>(open, onDismiss);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(
    () => groupMachines(filterMachines(machines, query), sort),
    [machines, query, sort],
  );
  const matched = groups.reduce((n, g) => n + g.machines.length, 0);

  // Open on the search field rather than on the current machine: the text is
  // remembered, so the current machine may not be listed at all and there would
  // be no row to land on. The row is scrolled to instead, where it survived.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    listRef.current
      ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, query, sort]);

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

        <div className={styles.controls}>
          <input
            ref={searchRef}
            type="search"
            className={styles.search}
            value={query}
            placeholder="Search machines"
            aria-label="Search machines"
            aria-controls="machine-picker-list"
            onChange={(e) => onQueryChange(e.target.value)}
            // In the New-project dialog this list renders inside the form whose
            // submit creates the project, so a bare field would create one on
            // Enter with the picker still open. The rows carry `type="button"`
            // against the same hazard.
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          />
          <label className={`${dialog.inline} ${styles.sort}`}>
            Sort by
            <select
              value={sort}
              aria-label="Sort machines by"
              onChange={(e) => onSortChange(e.target.value as MachineSort)}
            >
              {MACHINE_SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div ref={listRef} id="machine-picker-list" className={styles.groups}>
          {groups.map((group) => (
            <div key={group.heading ?? 'all'} className={styles.group}>
              {group.heading !== null && (
                <h3 className={styles.groupName}>{group.heading}</h3>
              )}
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
          {matched === 0 && (
            <p className={styles.noMatch}>
              No machine matches “{query.trim()}”.{' '}
              <button type="button" onClick={() => onQueryChange('')}>
                Show every machine
              </button>
            </p>
          )}
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
