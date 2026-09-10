/**
 * Projecting the held machine's display to something that can show a web page.
 *
 * The outcome is an address and nothing more: a stream is not a thing an
 * operation can answer with, since every outcome has to survive being written
 * as JSON. What is at the address, and how the picture gets there, belongs to
 * the caller that supplied the {@link ViewProjection} - here it is one call and
 * one string.
 *
 * A viewer is not a caller. It holds no machine, reaches no operation and
 * cannot act on what it is shown, which is what lets a machine be watched
 * without being shared.
 */

import type { Operation, ViewOpened } from './types';

export interface ViewOutcome {
  /** Where to point something that can show a web page, or null when nowhere. */
  address: string | null;
  /** Whether a view was already open, and this is that one. */
  already: boolean;
  /** Whether a play channel onto the same machine was ended to open this. */
  endedPlay: boolean;
  /** Why there is no address, when there is none. */
  problem: string | null;
}

/** What a caller is told when its toolchain cannot project anything. */
export const CANNOT_PROJECT =
  'This toolchain cannot project a view. A view is projected by a host that ' +
  'is holding the machine for you.';

/** What a caller is told about a machine there is no picturing. */
export const CANNOT_BE_PICTURED =
  'This machine cannot be pictured, so a view of it would show nothing.';

export const viewOp: Operation<Record<never, never>, ViewOutcome> = {
  name: 'view',
  summary: 'Project the display to an address a web view can be pointed at.',
  description:
    'Project the running machine to an address anything that can show a web ' +
    'page can be pointed at, so a person or an application can watch the ' +
    'screen while you work. Returns the address. The view mirrors the ' +
    'machine and never drives it, so nothing about what you do changes for ' +
    'having been watched, and whoever watches cannot act on the machine. ' +
    'Asking again while a view is open returns the same address.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'operation', name: 'view' },
  mcp: { kind: 'tool' },
  // A machine is projected one way or the other, and asking for a view of one
  // that is being played is how a caller changes which - so it is answered,
  // and the play channel ends.
  played: 'answer',
  run: async (_input, ctx): Promise<ViewOutcome> => {
    if (!ctx.view) {
      return {
        address: null,
        already: false,
        endedPlay: false,
        problem: CANNOT_PROJECT,
      };
    }
    // A machine with no picture would be given an address showing nothing,
    // which is worse than being told. Asked of the session rather than of the
    // dialect because painting is what actually has to work, and capture()
    // spends none of the machine's frames.
    if (ctx.session?.capture() === null) {
      return {
        address: null,
        already: false,
        endedPlay: false,
        problem: CANNOT_BE_PICTURED,
      };
    }
    const opened: ViewOpened = await ctx.view.open();
    return {
      address: opened.address,
      already: opened.already,
      endedPlay: opened.endedPlay,
      problem: opened.problem,
    };
  },
  // No address is the operation not having done what was asked: a caller that
  // wanted somewhere to point a web view has nowhere.
  failed: (outcome) => outcome.address === null,
  describe: (outcome) => {
    if (!outcome.address) return outcome.problem ?? 'No view could be opened.';
    const opening = outcome.already
      ? 'The view already open is at'
      : 'The display is being projected to';
    const ended = outcome.endedPlay
      ? ' The play channel onto this machine has ended; a machine is ' +
        'projected one way or the other.'
      : '';
    return (
      `${opening} ${outcome.address} - show it in a web view or open it in a ` +
      'browser. It is reachable from this computer only, anyone holding the ' +
      'address can watch, and watching does not act on the machine.' +
      ended
    );
  },
};
