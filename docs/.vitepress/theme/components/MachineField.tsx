// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * One of the porting guide's two machine fields, as a React island: the IDE's
 * own `MachineTrigger` and `MachinePickerDialog`, imported and rendered - not
 * a docs-side lookalike of them.
 *
 * Everything here is controlled by the Vue wrapper (`MachinePicker.vue`),
 * including whether the list is open. That is deliberate: the guide has two
 * fields where the IDE has one, and "opening one closes the other" is a fact
 * about the pair, so it lives with the pair rather than in either half of it.
 *
 * The picker asks a machine for five fields (`MachineLike`), which the guide's
 * own machine list supplies - so no part of the dialect registry, and no
 * emulator core, is reachable from here. `machinePickerBoundary.test.ts` in the
 * app holds that line.
 */

import { MachinePickerDialog } from '../../../../src/components/MachinePickerDialog';
import { MachineTrigger } from '../../../../src/components/MachineTrigger';
import type { MachineLike } from '../../../../src/components/machinePicker';

export interface MachineFieldProps {
  machines: readonly MachineLike[];
  /** The machine this field currently names. */
  selectedId: string;
  /** What this machine is to the reader, e.g. `'Porting from'`. */
  role: string;
  open: boolean;
  onOpen: () => void;
  onDismiss: () => void;
  onChoose: (id: string) => void;
}

export function MachineField({
  machines,
  selectedId,
  role,
  open,
  onOpen,
  onDismiss,
  onChoose,
}: MachineFieldProps) {
  const machine = machines.find((m) => m.id === selectedId) ?? machines[0];
  if (!machine) return null;
  return (
    <>
      <MachineTrigger
        dialect={machine}
        role={role}
        onClick={onOpen}
        // As in the New-project dialog: the year is what tells a 464 from a
        // 6128 without opening the list, which is the confusion this picker is
        // here to end. The toolbar omits it only for want of room.
        showYear
        className="mp-trigger"
      />
      <MachinePickerDialog
        open={open}
        machines={machines}
        selectedId={machine.id}
        onChoose={onChoose}
        onDismiss={onDismiss}
      />
    </>
  );
}
