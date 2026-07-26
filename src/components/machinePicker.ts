// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The machine picker's decisions, as pure functions: how machines are grouped
 * for the list, and the labels the collapsed trigger and the list rows carry.
 * Kept out of the components so they are unit-testable (the project's component
 * logic lives in plain `.ts` siblings - see `inputOverlayMode.ts`,
 * `memoryBands.ts`).
 *
 * These used to live in `newProjectOptions.ts`. The picker is now shared with
 * the toolbar's target switcher, so its logic is no longer new-project specific.
 */

import type { Dialect } from '../dialects/types';

/** One manufacturer's machines, as shown in the picker. */
export interface MachineGroup {
  manufacturer: string;
  machines: Dialect[];
}

/**
 * Machines grouped under their manufacturer, since that is how people think
 * about these computers. Manufacturers are ordered alphabetically and each
 * one's machines oldest-first, so the picker's order is stable and does not
 * shift as dialects are registered.
 */
export function groupMachinesByManufacturer(
  machines: readonly Dialect[],
): MachineGroup[] {
  const byMaker = new Map<string, Dialect[]>();
  for (const d of machines) {
    const group = byMaker.get(d.manufacturer);
    if (group) group.push(d);
    else byMaker.set(d.manufacturer, [d]);
  }
  return [...byMaker.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([manufacturer, group]) => ({
      manufacturer,
      machines: group.sort(
        (a, b) => a.year - b.year || a.name.localeCompare(b.name),
      ),
    }));
}

/**
 * Maker and year for a machine, e.g. `'Commodore 1982'`. Shown beside the name
 * on a collapsed trigger, where the manufacturer group heading is not in view.
 */
export function machineSummary(dialect: Dialect): string {
  return `${dialect.manufacturer} ${dialect.year}`;
}

/**
 * The accessible name of the control that opens the picker. It names the
 * current machine as well as the control's purpose, because the label is hidden
 * at narrow widths and the illustration alone carries no text.
 */
export function targetMachineLabel(dialect: Dialect): string {
  return `Target machine: ${dialect.name}`;
}

/**
 * The accessible name of a machine's row in the picker. Names prefix one
 * another ("Spectrum" / "Spectrum 128"), so the maker and year disambiguate.
 */
export function machineChoiceLabel(dialect: Dialect): string {
  return `${dialect.name}, ${machineSummary(dialect)}`;
}
