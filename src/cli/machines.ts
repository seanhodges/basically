// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The registered machines, as data and as a table.
 *
 * Reads no ROM and boots nothing: whether a machine's ROM is here is a question
 * about a file's existence, and the answer is what tells a caller which
 * machines it can actually run before it tries.
 */

import { hasRom } from '../dialects/bootHarness';
import { findMachine, machineList } from '../dialects/headless/runListing';
import { locateRoms } from './roms';

export interface MachineSummary {
  /** The identifier every other operation takes, e.g. `zx81`. */
  id: string;
  name: string;
  /** The one-line description the machine picker shows. */
  description: string;
  /** Whether this installation carries the machine's ROM. */
  romPresent: boolean;
}

export function listMachines(): MachineSummary[] {
  locateRoms();
  return machineList().map((machine) => {
    const dialect = findMachine(machine.id);
    return {
      id: machine.id,
      name: machine.name,
      description: machine.blurb,
      romPresent: dialect !== undefined && hasRom(dialect),
    };
  });
}

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
