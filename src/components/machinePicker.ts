// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The machine picker's decisions, as pure functions: how machines are grouped
 * for the list, and the labels the collapsed trigger and the list rows carry.
 * Kept out of the components so they are unit-testable (the project's component
 * logic lives in plain `.ts` siblings - see `inputOverlayMode.ts`,
 * `memoryBands.ts`).
 *
 * Shared with the toolbar's target switcher, so nothing here is new-project
 * specific.
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
  /** The BASIC it runs, e.g. 'Locomotive BASIC 1.1'. Grouped and searched on. */
  basicDialect: string;
  blurb: string;
}

/** How the reader has asked for the list to be arranged. */
export type MachineSort = 'manufacturer' | 'model' | 'year' | 'basic';

/**
 * The arrangements, in the order the control offers them, each with the label
 * it is offered under. One list, read by the control, by the stored-value
 * validator and by the tests, so none of them can drift from the others.
 */
export const MACHINE_SORTS: readonly { id: MachineSort; label: string }[] = [
  { id: 'manufacturer', label: 'Manufacturer' },
  { id: 'model', label: 'Model' },
  { id: 'year', label: 'Year' },
  { id: 'basic', label: 'BASIC dialect' },
];

/** What a reader who has never chosen an arrangement gets. */
export const DEFAULT_MACHINE_SORT: MachineSort = 'manufacturer';

/**
 * One heading's machines, as shown in the picker. A null heading is the
 * ungrouped arrangement, which the dialog renders as rows with nothing above
 * them - so every arrangement is one loop rather than a branch per mode.
 */
export interface MachineGroup {
  heading: string | null;
  machines: MachineLike[];
}

/**
 * The one name comparator. `numeric` is the whole point: a plain string compare
 * puts CPC 6128 before CPC 664, because it reaches the second digit before it
 * has any idea it is reading a number. Built once at module level - a collator
 * constructed inside a sort callback is built once per comparison.
 */
const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/** Alphabetical by name, reading a model number as a number. */
export function compareMachineNames(a: MachineLike, b: MachineLike): number {
  return byName.compare(a.name, b.name);
}

/**
 * The machines matching what the reader typed: a case-insensitive substring of
 * the machine's name, its maker, or the BASIC it runs. Empty text matches
 * everything, so the caller never has to special-case an untouched field.
 *
 * Deliberately not the blurb: a description mentioning "games" would pull in
 * machines the reader was not asking about, and the three fields here are the
 * ones a row is identified by.
 */
export function filterMachines(
  machines: readonly MachineLike[],
  query: string,
): MachineLike[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...machines];
  return machines.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.manufacturer.toLowerCase().includes(q) ||
      m.basicDialect.toLowerCase().includes(q),
  );
}

/**
 * Group the machines under `keyOf`, ordering the headings by `compareHeadings`
 * and every group's machines by name.
 *
 * Headings come from the machines in hand and never from a fixed list of years,
 * makers or BASICs. That is what makes "no empty heading" a property rather
 * than a rule to enforce: a year no machine was released in produces no key,
 * and a search that removes a group's last machine removes the group with it.
 */
function groupBy(
  machines: readonly MachineLike[],
  keyOf: (m: MachineLike) => string,
  compareHeadings: (a: string, b: string) => number,
): MachineGroup[] {
  const byHeading = new Map<string, MachineLike[]>();
  for (const m of machines) {
    const group = byHeading.get(keyOf(m));
    if (group) group.push(m);
    else byHeading.set(keyOf(m), [m]);
  }
  return [...byHeading.entries()]
    .sort(([a], [b]) => compareHeadings(a, b))
    .map(([heading, group]) => ({
      heading,
      machines: group.sort(compareMachineNames),
    }));
}

/**
 * Machines grouped under their manufacturer, since that is how people think
 * about these computers. Manufacturers alphabetical, each one's machines by
 * name, so the picker's order is stable and does not shift as dialects are
 * registered.
 */
export function groupMachinesByManufacturer(
  machines: readonly MachineLike[],
): MachineGroup[] {
  return groupBy(
    machines,
    (m) => m.manufacturer,
    (a, b) => a.localeCompare(b),
  );
}

/**
 * The machines as the chosen arrangement shows them.
 *
 * Every arrangement but `year` orders its rows by name; `year` heads each
 * distinct release year, oldest at the top, and orders by name inside a year
 * because every machine under that heading shares it.
 */
export function groupMachines(
  machines: readonly MachineLike[],
  sort: MachineSort,
): MachineGroup[] {
  switch (sort) {
    case 'model':
      return machines.length === 0
        ? []
        : [
            {
              heading: null,
              machines: [...machines].sort(compareMachineNames),
            },
          ];
    case 'year':
      return groupBy(
        machines,
        (m) => String(m.year),
        (a, b) => Number(a) - Number(b),
      );
    case 'basic':
      return groupBy(
        machines,
        (m) => m.basicDialect,
        (a, b) => a.localeCompare(b),
      );
    case 'manufacturer':
      return groupMachinesByManufacturer(machines);
  }
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
