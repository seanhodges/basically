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

/**
 * Everything the picker asks of a machine: five fields, no more. `Dialect`
 * satisfies it structurally, and so does the porting guide's `MachineChoice` -
 * which is what lets one picker serve the IDE and the docs without an adapter
 * on either side.
 *
 * Declared here rather than imported from `../dialects/types`, so this module
 * and the components built on it are genuinely self-contained. `types.ts` is
 * not types-only - it exports `CharsetError` and friends at runtime - so a
 * picker that imported it would be safe to bundle into the docs only for as
 * long as every one of those imports stayed an erased `import type`. The
 * import-graph guard (`machinePickerBoundary.test.ts`) has something clean to
 * assert because of this.
 */
export interface MachineLike {
  id: string;
  name: string;
  year: number;
  manufacturer: string;
  blurb: string;
}

/** One manufacturer's machines, as shown in the picker. */
export interface MachineGroup {
  manufacturer: string;
  machines: MachineLike[];
}

/**
 * Machines grouped under their manufacturer, since that is how people think
 * about these computers. Manufacturers are ordered alphabetically and each
 * one's machines oldest-first, so the picker's order is stable and does not
 * shift as dialects are registered.
 */
export function groupMachinesByManufacturer(
  machines: readonly MachineLike[],
): MachineGroup[] {
  const byMaker = new Map<string, MachineLike[]>();
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
export function machineSummary(machine: MachineLike): string {
  return `${machine.manufacturer} ${machine.year}`;
}

/**
 * The accessible name of the control that opens the picker. It names the
 * current machine as well as the part the control plays, because the label is
 * hidden at narrow widths and the illustration alone carries no text.
 *
 * The role is the caller's to supply: the IDE has one machine and it is the
 * target, while the porting guide has two and one of them is the machine being
 * ported *from* - which "Target machine" would describe not merely tersely but
 * wrongly.
 */
export function machineTriggerLabel(
  role: string,
  machine: MachineLike,
): string {
  return `${role}: ${machine.name}`;
}

/** The role every machine control in the IDE plays. */
export const TARGET_MACHINE_ROLE = 'Target machine';

/**
 * The accessible name an IDE trigger ends up with - `targetMachineLabel` and
 * `TARGET_MACHINE_ROLE` are the same fact stated for the two things that need
 * it, the label a reader hears and the prop a call site passes.
 */
export function targetMachineLabel(machine: MachineLike): string {
  return machineTriggerLabel(TARGET_MACHINE_ROLE, machine);
}

/**
 * The accessible name of a machine's row in the picker. Names prefix one
 * another ("Spectrum" / "Spectrum 128"), so the maker and year disambiguate.
 */
export function machineChoiceLabel(machine: MachineLike): string {
  return `${machine.name}, ${machineSummary(machine)}`;
}
