// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore } from '../app/store';
import { dialects } from '../dialects/registry';
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

  return (
    <MachinePickerDialog
      open={open}
      machines={dialects}
      selectedId={activeId}
      onChoose={(id) => {
        setOpen(false);
        setDialect(id);
      }}
      onDismiss={() => setOpen(false)}
    />
  );
}
