/**
 * Projecting a map of the held machine's memory to something that can show a
 * web page.
 *
 * The outcome is an address and nothing more, for the reason a view's is: a
 * stream is not a thing an operation can answer with, since every outcome has
 * to survive being written as JSON. What is at the address, and how the layout
 * and the activity get there, belongs to the caller that supplied the
 * {@link MapProjection}.
 *
 * A map is not a display, so it does not displace one. A view and a play
 * channel are two ways of showing one screen and a machine has one or the
 * other; a map shows what neither of them shows, and may be open beside either.
 * That is what makes it worth having: a held machine advances unasked only
 * while it is being played, so a map that ended the play channel would show a
 * still picture of a stopped machine.
 *
 * Whoever is shown a map is not a caller. They hold no machine, reach no
 * operation, and can learn from the address only which addresses the machine
 * touched - never what any of them holds, because that is not what a machine
 * records and there is nothing here that could carry it.
 */

import type { MapOpened, Operation } from './types';

export interface MapOutcome {
  /** Where to point something that can show a web page, or null when nowhere. */
  address: string | null;
  /** Whether a map was already open, and this is that one. */
  already: boolean;
  /** Why there is no address, when there is none. */
  problem: string | null;
}

/** What a caller is told when its toolchain cannot project a map. */
export const CANNOT_PROJECT_MAP =
  'This toolchain cannot project a map of a machine’s memory. A map is ' +
  'served by a host that is holding the machine for you.';

/** What a caller is told about a machine whose layout is not described. */
export const CANNOT_BE_MAPPED =
  'The toolchain does not describe this machine’s memory layout, so there is ' +
  'no map of it to show.';

export const mapOp: Operation<Record<never, never>, MapOutcome> = {
  name: 'map',
  summary: 'Project the machine’s memory to an address a web view can show.',
  description:
    'Project a map of the running machine’s memory to an address anything ' +
    'that can show a web page can be pointed at, so a person or an ' +
    'application can watch where in memory the program is living while you ' +
    'work. Returns the address. The map shows the machine’s regions and the ' +
    'addresses its processor is reading and writing as the program runs; it ' +
    'never shows what an address holds and never acts on the machine, so ' +
    'nothing you measure changes for having been mapped. A map is not a ' +
    'display: it can be open beside a view or a play channel, and opening it ' +
    'ends neither. Asking again while a map is open returns the same address.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'operation', name: 'map' },
  mcp: { kind: 'tool' },
  // Asking for a map only reads the machine, and the one circumstance in which
  // a held machine advances of its own accord is while it is being played - so
  // a played machine is exactly the machine worth mapping.
  played: 'answer',
  run: async (_input, ctx): Promise<MapOutcome> => {
    if (!ctx.map) {
      return { address: null, already: false, problem: CANNOT_PROJECT_MAP };
    }
    // A machine whose layout the toolchain does not describe has no map to
    // project, and would be given an address showing nothing. Told apart from
    // a machine that has a layout but no bus to tap, which has a map that
    // simply says it cannot report what it is touching.
    if (!ctx.map.mappable()) {
      return { address: null, already: false, problem: CANNOT_BE_MAPPED };
    }
    const opened: MapOpened = await ctx.map.open();
    return {
      address: opened.address,
      already: opened.already,
      problem: opened.problem,
    };
  },
  // No address is the operation not having done what was asked: a caller that
  // wanted somewhere to point a web view has nowhere.
  failed: (outcome) => outcome.address === null,
  describe: (outcome) => {
    if (!outcome.address) return outcome.problem ?? 'No map could be opened.';
    const opening = outcome.already
      ? 'The map already open is at'
      : 'The machine’s memory is being mapped to';
    return (
      `${opening} ${outcome.address} - show it in a web view or open it in a ` +
      'browser. It is reachable from this computer only, anyone holding the ' +
      'address can watch the memory, and watching neither acts on the machine ' +
      'nor reveals what any address holds. A view or a play channel of this ' +
      'machine is unaffected: a map is not a display.'
    );
  },
};
