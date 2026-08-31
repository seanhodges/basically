// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore } from '../app/store';
import { useRunnableMachines } from '../app/machineAvailability';
import { MachinePickerDialog } from './MachinePickerDialog';

/**
 * The machine picker as raised from the toolbar's target control - the store
 * binding around the shared `MachinePickerDialog`.
 *
 * Mounted at app level like every other modal, not inside the toolbar: the
 * toolbar is a stacking context (`Toolbar.module.css` gives it `z-index: 40`),
 * so a fixed overlay rendered within it would sit under the docs drawer and
 * under other dialogs.
 *
 * Choosing closes the picker *before* calling `setDialect`, because a switch
 * the user must resolve raises `SwitchTargetDialog` - which would otherwise
 * appear underneath this one.
 */
export function TargetMachineDialog() {
  const open = useIdeStore((s) => s.machinePickerOpen);
  const setOpen = useIdeStore((s) => s.setMachinePickerOpen);
  const setDialect = useIdeStore((s) => s.setDialect);
  const activeId = useIdeStore((s) => s.dialect.id);
  // Minus any machine whose ROM is not there to run - plus the current one,
  // whatever its state. See `useRunnableMachines`.
  const machines = useRunnableMachines(activeId);
  // Shared with the New-project dialog's picker, and persisted: one machine
  // list, narrowed and arranged one way.
  const query = useIdeStore((s) => s.machinePickerQuery);
  const sort = useIdeStore((s) => s.machinePickerSort);
  const setQuery = useIdeStore((s) => s.setMachinePickerQuery);
  const setSort = useIdeStore((s) => s.setMachinePickerSort);

  return (
    <MachinePickerDialog
      open={open}
      machines={machines}
      selectedId={activeId}
      query={query}
      sort={sort}
      onQueryChange={setQuery}
      onSortChange={setSort}
      onChoose={(id) => {
        setOpen(false);
        setDialect(id);
      }}
      onDismiss={() => setOpen(false)}
    />
  );
}
