// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The registered machines as a table. The data is the `machines` operation's
 * (`src/ops/machines.ts`); only the column layout is the command line's.
 */

import type { MachineSummary } from '../ops/machines';

export type { MachineSummary } from '../ops/machines';

/** The machines as aligned columns, one per line. */
export function formatMachines(machines: readonly MachineSummary[]): string {
  const idWidth = Math.max(...machines.map((m) => m.id.length));
  const nameWidth = Math.max(...machines.map((m) => m.name.length));
  return machines
    .map(
      (m) =>
        `${m.id.padEnd(idWidth)}  ${m.name.padEnd(nameWidth)}  ` +
        `${m.romPresent ? 'rom' : '  -'}  ${m.description}`,
    )
    .join('\n');
}
