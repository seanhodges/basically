/**
 * The registered machines, as data.
 *
 * Reads no ROM and boots nothing: whether a machine's ROM is here is a question
 * the context answers, and the answer is what tells a caller which machines it
 * can actually run before it tries.
 */

import { findMachine, machineList } from '../dialects/machineLookup';
import type { OpContext, Operation } from './types';

export interface MachineSummary {
  /** The identifier every other operation takes, e.g. `zx81`. */
  id: string;
  name: string;
  /** The one-line description the machine picker shows. */
  description: string;
  /** Whether this installation carries the machine's ROM. */
  romPresent: boolean;
}

export type MachinesInput = Record<never, never>;

export function listMachines(ctx: OpContext): MachineSummary[] {
  return machineList().map((machine) => {
    const dialect = findMachine(machine.id);
    return {
      id: machine.id,
      name: machine.name,
      description: machine.blurb,
      romPresent: dialect !== undefined && ctx.roms.present(dialect),
    };
  });
}

export const machinesOp: Operation<MachinesInput, MachineSummary[]> = {
  name: 'machines',
  summary: 'List every machine, and whether its ROM is here.',
  description:
    'List every registered machine: the identifier every other operation ' +
    'takes, its name, a one-line description, and whether its ROM is present ' +
    'here. Ask when the question is about another machine than the one this ' +
    'conversation is for, such as porting a program.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'roms',
  cli: { kind: 'operation', name: 'machines' },
  assistant: { kind: 'tool' },
  run: (_input, ctx) => listMachines(ctx),
  describe: (machines) =>
    machines
      .map(
        (m) =>
          `${m.id}: ${m.name} - ${m.description}` +
          `${m.romPresent ? '' : ' (no ROM here)'}`,
      )
      .join('\n'),
};
