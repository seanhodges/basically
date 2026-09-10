/**
 * Playing the held machine: driving it live from something that can show a web
 * page.
 *
 * The outcome is an address and nothing more, for the reason a view's is: a
 * socket is not a thing an operation can answer with, since every outcome has
 * to survive being written as JSON. What is at the address, how the picture
 * gets there and how a key gets back belong to the caller that supplied the
 * {@link PlayProjection}.
 *
 * Whoever plays is not a caller. They hold no machine, reach no operation and
 * can do nothing to the toolchain; what they have is the machine's keyboard and
 * its screen. What their address admits is nevertheless a larger claim than a
 * view's, and every place this is described says so in its own words rather
 * than by pointing at the view's.
 *
 * Playing costs the caller something, and the description says what: while the
 * channel is open the machine is being driven by a person, so it advances
 * without any request having asked it to and nothing taken from it is a
 * measurement. The operations that would take one are refused until the
 * channel ends - which is `Operation.played`, declared beside each of them.
 */

import type { Operation, PlayOpened } from './types';

export interface PlayOutcome {
  /** Where to point something that can show a web page, or null when nowhere. */
  address: string | null;
  /** Whether a play channel was already open, and this is that one. */
  already: boolean;
  /** Whether a view of the same machine was ended to open this. */
  endedView: boolean;
  /** Why there is no address, when there is none. */
  problem: string | null;
}

/** What a caller is told when its toolchain cannot serve a play channel. */
export const CANNOT_PLAY =
  'This toolchain cannot serve a play channel. A machine is played through a ' +
  'host that is holding it for you.';

/** What a caller is told about a machine there is no picturing. */
export const CANNOT_BE_PLAYED =
  'This machine cannot be pictured, so playing it would show nothing.';

/** What a caller is told when it asks something of a machine being played. */
export function beingPlayed(operation: string): string {
  return (
    'This machine is being played, so it is advancing on its own clock and is ' +
    'not a machine anything can act on or measure: it is being driven by ' +
    `whoever is playing rather than by requests. "${operation}" is refused ` +
    'until the play channel is given up - "basically play --stop" - after ' +
    'which the machine advances only when a request asks it to again, and ' +
    'everything you can measure of it means what it used to. Reading the ' +
    'screen ("look", "screenshot") is answered while playing, of a machine ' +
    'that is moving.'
  );
}

export const playOp: Operation<Record<never, never>, PlayOutcome> = {
  name: 'play',
  summary: 'Open an address a web view can be pointed at to drive the machine.',
  description:
    'Open a play channel onto the running machine at an address anything ' +
    'that can show a web page can be pointed at, so a person can see the ' +
    'screen and type at it. Returns the address. While the channel is open ' +
    'the machine runs on its own clock rather than only when a request asks ' +
    'it to, so requests that act on it or measure it are refused until you ' +
    'give the channel up; reading the screen still works and catches a ' +
    'machine that is moving. A machine has a play channel or a view, never ' +
    'both, and asking for one ends the other. Asking again while a channel ' +
    'is open returns the same address.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'operation', name: 'play' },
  // Asking to play a machine that is already being played is how a caller that
  // lost its address gets it back, so this is answered rather than refused.
  played: 'answer',
  run: async (_input, ctx): Promise<PlayOutcome> => {
    if (!ctx.play) {
      return {
        address: null,
        already: false,
        endedView: false,
        problem: CANNOT_PLAY,
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
        endedView: false,
        problem: CANNOT_BE_PLAYED,
      };
    }
    const opened: PlayOpened = await ctx.play.open();
    return {
      address: opened.address,
      already: opened.already,
      endedView: opened.endedView,
      problem: opened.problem,
    };
  },
  // No address is the operation not having done what was asked: a caller that
  // wanted somewhere to point a web view has nowhere.
  failed: (outcome) => outcome.address === null,
  describe: (outcome) => {
    if (!outcome.address) {
      return outcome.problem ?? 'No play channel could be opened.';
    }
    const opening = outcome.already
      ? 'The play channel already open is at'
      : 'The machine can be played at';
    const ended = outcome.endedView
      ? ' The view of this machine has ended; a machine is projected one way ' +
        'or the other.'
      : '';
    return (
      `${opening} ${outcome.address} - show it in a web view or open it in a ` +
      'browser. It is reachable from this computer only, and anyone holding ' +
      'the address can type at the machine, not merely watch it.' +
      ' While it is open the machine advances on its own clock, so requests ' +
      'that act on it or measure it are refused until you give it up.' +
      ended
    );
  },
};
