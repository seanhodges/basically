import { describe, expect, it } from 'vitest';
import { CallRefused, runOperation, WITHOUT_A_MACHINE } from '../server/ops';
import {
  breakOp,
  CANNOT_STEP,
  continueOp,
  stepOp,
  whereOp,
  type DebugRunOutcome,
} from './debug';
import { OPERATIONS } from './registry';
import { pureContext, stubSession } from './testSupport';
import type { OpContext, PlayProjection } from './types';

/**
 * The four operations over a stub session.
 *
 * What a real machine does when it is stopped and stepped is proved against the
 * real ROMs where the stopping lives - `src/app/machineControl.test.ts` and
 * `src/mcp/session.test.ts`. What is left here is the operations themselves:
 * what they answer a caller holding no machine, what they answer about a
 * machine that cannot be stepped, what a played machine costs them, and that
 * every outcome is data.
 */

const DEBUG_OPERATIONS = ['break', 'step', 'continue', 'where'] as const;

/** What each takes, so a test can reach all four in one loop. */
const INPUTS: Record<string, unknown> = {
  break: { lines: [20] },
  step: {},
  continue: {},
  where: {},
};

/** Dispatch a call the way a host does, so the refusals are the real ones. */
function call(operation: string, ctx: OpContext, input: unknown = {}) {
  return runOperation(
    operation,
    input,
    { context: () => ctx, heldMachine: () => ({ name: 'ZX81', token: 1 }) },
    (op) => op.cli !== undefined,
  );
}

/** A channel that is open, so a machine is being played. */
const PLAYING: PlayProjection = {
  open: () =>
    Promise.resolve({
      address: 'http://127.0.0.1:1/p/abc/',
      problem: null,
      already: true,
      endedView: false,
    }),
  playing: () => true,
};

describe('asking a machine that is up where it is', () => {
  it('reports the line, the program and the lines in force', () => {
    const session = stubSession({
      position: () => ({
        canStep: true,
        line: 30,
        running: true,
        breakpoints: [20, 30],
      }),
    });

    const outcome = whereOp.run({}, pureContext({ session }));

    expect(outcome).toEqual({
      canStep: true,
      line: 30,
      running: true,
      breakpoints: [20, 30],
    });
    expect(whereOp.describe(outcome)).toContain('stopped before line 30');
    expect(whereOp.describe(outcome)).toContain('20, 30');
  });

  it('says no line rather than reporting one when nothing is running', () => {
    const session = stubSession({
      position: () => ({
        canStep: true,
        line: null,
        running: false,
        breakpoints: [],
      }),
    });

    const described = whereOp.describe(
      whereOp.run({}, pureContext({ session })),
    );

    expect(described).toContain('No program is running');
    expect(described).toContain('No line is set to stop on');
  });

  it('answers the same twice, having advanced nothing', () => {
    let frames = 0;
    const session = stubSession({
      advance: (n) => {
        frames += n;
        return { ok: true, frames: n };
      },
    });
    const ctx = pureContext({ session });

    expect(whereOp.run({}, ctx)).toEqual(whereOp.run({}, ctx));
    expect(frames).toBe(0);
  });
});

describe('naming the lines to stop before', () => {
  it('replaces what was in force and reports what is', () => {
    const session = stubSession();
    const ctx = pureContext({ session });

    // Read back off the machine rather than echoed, so the lines reported are
    // the lines in force; how they are ordered is the driver's, and
    // `src/app/machineControl.test.ts` pins it.
    expect(breakOp.run({ lines: [20, 30] }, ctx).lines).toEqual([20, 30]);
    expect(breakOp.run({ lines: [40] }, ctx).lines).toEqual([40]);
    // Naming none clears them, so the program stops nowhere.
    const cleared = breakOp.run({ lines: [] }, ctx);
    expect(cleared.lines).toEqual([]);
    expect(breakOp.describe(cleared)).toContain('stops nowhere');
  });

  it('keeps a line the program does not carry, for one about to be written', () => {
    const session = stubSession();
    const outcome = breakOp.run({ lines: [9999] }, pureContext({ session }));
    expect(outcome.lines).toEqual([9999]);
    expect(session.stops).toEqual([9999]);
  });
});

describe('stepping and continuing', () => {
  it('reports where the program is and what it cost in the machine’s own time', () => {
    const session = stubSession({
      stepLine: () => ({
        ending: 'stopped',
        line: 40,
        frames: 120,
        seconds: 2.4,
      }),
      programState: () => true,
    });

    const outcome = stepOp.run({}, pureContext({ session }));

    expect(outcome).toMatchObject({
      canStep: true,
      ending: 'stopped',
      line: 40,
      frames: 120,
      seconds: 2.4,
      running: true,
    });
    expect(stepOp.describe(outcome)).toContain('stopped before line 40');
    expect(stepOp.describe(outcome)).toContain('2.40s');
  });

  it('reports exhausting its frames as an ordinary outcome, not a failure', () => {
    const session = stubSession({
      continueRun: () => ({
        ending: 'exhausted',
        line: 10,
        frames: 1000,
        seconds: 20,
      }),
      programState: () => true,
    });

    const outcome = continueOp.run({}, pureContext({ session }));

    expect(outcome.ending).toBe('exhausted');
    expect(continueOp.failed).toBeUndefined();
    const described = continueOp.describe(outcome);
    expect(described).toContain('neither a stop nor the end');
    expect(described).toContain('ordinary BASIC program');
  });

  it('spends the frames it was given rather than a bound of its own', () => {
    const asked: number[] = [];
    const session = stubSession({
      stepLine: (max) => {
        asked.push(max!);
        return { ending: 'ended', line: null, frames: 1, seconds: 0.02 };
      },
    });
    const ctx = pureContext({ session });

    stepOp.run({ maxFrames: 60 }, ctx);
    stepOp.run({}, ctx);

    expect(asked[0]).toBe(60);
    // The bound every other wait on this machine uses, when none is named.
    expect(asked[1]).toBe(1000);
  });

  it('says the program ended rather than naming a line it never reached', () => {
    const session = stubSession({
      stepLine: () => ({
        ending: 'ended',
        line: null,
        frames: 3,
        seconds: 0.06,
      }),
    });

    const outcome = stepOp.run({}, pureContext({ session }));

    expect([outcome.ending, outcome.line]).toEqual(['ended', null]);
    expect(stepOp.describe(outcome)).toContain('The program ended');
  });
});

describe('a machine that cannot be stepped', () => {
  const unsteppable = () =>
    stubSession({
      canStep: () => false,
      position: () => ({
        canStep: false,
        line: null,
        running: false,
        breakpoints: [],
      }),
    });

  it('is answered rather than failing, and told what it can still do', () => {
    const session = unsteppable();
    const ctx = pureContext({ session });

    const named = breakOp.run({ lines: [20] }, ctx);
    expect(named).toEqual({ canStep: false, lines: [] });
    // And no stop was set, so nothing is waiting on a line that never comes.
    expect(session.stops).toEqual([]);

    for (const outcome of [
      stepOp.run({}, ctx) as DebugRunOutcome,
      continueOp.run({}, ctx) as DebugRunOutcome,
    ]) {
      expect(outcome.canStep).toBe(false);
      expect(outcome.ending).toBe('cannot-step');
      expect(outcome.frames).toBe(0);
    }
  });

  it('says so in the same words wherever it is said', () => {
    const ctx = pureContext({ session: unsteppable() });
    for (const [op, input] of [
      [breakOp, { lines: [20] }],
      [stepOp, {}],
      [continueOp, {}],
      [whereOp, {}],
    ] as const) {
      const described = op.describe(op.run(input as never, ctx) as never);
      expect(described, op.name).toContain(CANNOT_STEP);
      // Naming what is still possible, so a caller does not read one refusal
      // as the machine being useless.
      expect(described, op.name).toContain('drive it with a schedule');
    }
  });
});

describe('what each of the four needs', () => {
  it('says how to get a machine when the caller holds none', async () => {
    const ctx = pureContext();
    for (const operation of DEBUG_OPERATIONS) {
      const refused = await call(operation, ctx, INPUTS[operation]).catch(
        (error: unknown) => error,
      );
      expect(refused, operation).toBeInstanceOf(CallRefused);
      expect((refused as CallRefused).message, operation).toBe(
        WITHOUT_A_MACHINE,
      );
    }
  });

  it('survives being written as JSON and read back', async () => {
    const ctx = pureContext({ session: stubSession() });
    for (const operation of DEBUG_OPERATIONS) {
      const { outcome } = await call(operation, ctx, INPUTS[operation]);
      expect(JSON.parse(JSON.stringify(outcome)), operation).toEqual(outcome);
    }
  });

  it('is reachable from the command line and from an agent, and from nothing else', () => {
    for (const name of DEBUG_OPERATIONS) {
      const op = OPERATIONS.find((o) => o.name === name)!;
      expect(op.cli, name).toEqual({ kind: 'operation', name });
      expect(op.mcp, name).toEqual({ kind: 'tool' });
      // The assistant's absence is a declared decision; `parity.test.ts` holds
      // the reason to its shape.
      expect(op.assistant, name).toBeUndefined();
      expect(op.needs, name).toBe('session');
    }
  });
});

describe('debugging and playing stay opposites', () => {
  it('refuses stopping, stepping and continuing while a machine is played', async () => {
    const ctx = pureContext({ session: stubSession(), play: PLAYING });
    for (const operation of ['break', 'step', 'continue']) {
      const refused = await call(operation, ctx, INPUTS[operation]).catch(
        (error: unknown) => error,
      );
      expect(refused, operation).toBeInstanceOf(CallRefused);
      expect((refused as CallRefused).message, operation).toContain(
        'being played',
      );
      expect((refused as CallRefused).message, operation).toContain(
        'basically play --stop',
      );
    }
  });

  it('answers asking where, of a machine that is moving', async () => {
    let line = 20;
    const session = stubSession({
      position: () => ({
        canStep: true,
        line: line++,
        running: true,
        breakpoints: [],
      }),
    });
    const ctx = pureContext({ session, play: PLAYING });

    const first = await call('where', ctx);
    const again = await call('where', ctx);

    expect(first.failed).toBe(false);
    // Two answers may differ without that being a fault: the machine is being
    // driven by whoever is playing it.
    expect(first.outcome).not.toEqual(again.outcome);
  });

  it('answers all three again the moment the channel ends', async () => {
    let playing = true;
    const ctx = pureContext({
      session: stubSession(),
      play: { ...PLAYING, playing: () => playing },
    });
    for (const operation of ['break', 'step', 'continue']) {
      await expect(call(operation, ctx, INPUTS[operation])).rejects.toThrow(
        CallRefused,
      );
    }
    playing = false;
    for (const operation of ['break', 'step', 'continue']) {
      expect((await call(operation, ctx, INPUTS[operation])).failed).toBe(
        false,
      );
    }
  });
});
