/**
 * The registered machines, as data.
 *
 * Reads no ROM and boots nothing: whether a machine can be run here is a
 * question the context answers, and the answer is what tells a caller which
 * machines it can actually run before it tries.
 */

import { findMachine, machineList } from '../dialects/machineLookup';
import type { OpContext, Operation } from './types';

export interface MachineSummary {
  /** The identifier every other operation takes, e.g. `zx81`. */
  id: string;
  name: string;
  /** The one-line description the machine picker shows. */
  description: string;
  /**
   * Whether this installation can run the machine - which is not the same as
   * carrying an image for it. A machine needing no ROM, and one whose emulator
   * carries its own set, both run on an installation with no images at all.
   */
  canRun: boolean;
}

export interface MachinesInput {
  /**
   * Where this caller reads ROM images from, when it keeps its own. Present so
   * that what each machine is reported as being able to do is decided against
   * the directory a run would actually read.
   */
  romRoot?: string;
}

export function listMachines(
  ctx: OpContext,
  romRoot?: string,
): MachineSummary[] {
  return machineList().map((machine) => {
    const dialect = findMachine(machine.id);
    return {
      id: machine.id,
      name: machine.name,
      description: machine.blurb,
      canRun: dialect !== undefined && ctx.roms.canRun(dialect, romRoot),
    };
  });
}

export const machinesOp: Operation<MachinesInput, MachineSummary[]> = {
  name: 'machines',
  summary: 'List every machine, and whether this installation can run it.',
  description:
    'List every registered machine: the identifier every other operation ' +
    'takes, its name, a one-line description, and whether this installation ' +
    'can run it. Ask when the question is about another machine than the one ' +
    'this ' +
    'conversation is for, such as porting a program.',
  input: {
    type: 'object',
    properties: { romRoot: { type: 'string' } },
    additionalProperties: false,
  },
  needs: 'roms',
  cli: { kind: 'operation', name: 'machines' },
  assistant: { kind: 'tool' },
  mcp: { kind: 'tool' },
  run: (input, ctx) => listMachines(ctx, input.romRoot),
  describe: (machines) =>
    machines
      .map(
        (m) =>
          `${m.id}: ${m.name} - ${m.description}` +
          `${m.canRun ? '' : ' (cannot be run here: no ROM)'}`,
      )
      .join('\n'),
};
