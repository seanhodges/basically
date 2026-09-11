import { describe, expect, it } from 'vitest';
import { stepLines } from '../app/driveScript';
import { cliContext } from '../cli/roms';
import { RunError } from '../dialects/headless/runError';
import { decodeBytes } from './bytes';
import { checkSchedule, runOp, type RunInput } from './run';

/**
 * A program run headlessly on a real machine, asked for everything the
 * command line can ask of a run. The ZX81 because it is the cheapest machine
 * to boot that can report its variables, its line costs and its screen.
 */

const wants = (over: Partial<RunInput>): RunInput => ({
  machine: 'zx81',
  source: '10 LET A=42\n20 PRINT A\n',
  screenText: true,
  screenshot: false,
  profile: false,
  time: false,
  variables: false,
  ...over,
});

describe('running a program', () => {
  it('measures, times and reads back a variable from one run', async () => {
    const outcome = await runOp.run(
      wants({ profile: true, time: true, variables: true }),
      cliContext(),
    );
    expect(outcome.errors).toEqual([]);
    expect(outcome.ended).toBe(true);
    expect(outcome.screen?.lines.some((l) => l.includes('42'))).toBe(true);

    // Where the time went: a line of this program, as a share of the run.
    expect(outcome.profile?.canProfile).toBe(true);
    const lines = outcome.profile?.measured?.lines ?? [];
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => [10, 20].includes(l.line))).toBe(true);
    // How long, together with how it ended.
    expect(outcome.time?.timing?.ending).toBe('finished');
    expect(outcome.time?.timing?.seconds).toBeGreaterThan(0);
    // What a variable holds at the end.
    expect(outcome.variables?.variables).toContainEqual(
      expect.objectContaining({ name: 'A', value: '42' }),
    );
    // And the whole outcome is data.
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
  }, 20_000);

  it('reports nothing it was not asked for, so the JSON a reader knows is unchanged', async () => {
    const outcome = await runOp.run(wants({}), cliContext());
    expect(outcome).not.toHaveProperty('profile');
    expect(outcome).not.toHaveProperty('time');
    expect(outcome).not.toHaveProperty('variables');
    expect(outcome.picture).toBeNull();
    expect(outcome.keys).toBeNull();
  }, 20_000);

  it('times a run the cap stopped as stopped, not as finished', async () => {
    const outcome = await runOp.run(
      wants({ source: '10 GOTO 10\n', maxFrames: 30, time: true }),
      cliContext(),
    );
    expect(outcome.ended).toBe(false);
    expect(outcome.time?.timing?.ending).toBe('stopped');
  }, 20_000);

  it('drives the run through a schedule and captures the screen it left', async () => {
    const outcome = await runOp.run(
      wants({
        source:
          '10 PRINT "PRESS A KEY"\n20 IF INKEY$="" THEN GOTO 20\n30 PRINT "IT WENT ON"\n',
        keys: 'WAIT FOR "PRESS A KEY"; PRESS A; WAIT FOR "IT WENT ON"',
        screenshot: true,
      }),
      cliContext(),
    );
    expect(outcome.keys?.ok).toBe(true);
    expect(stepLines(outcome.keys!.steps)).toEqual([
      '"PRESS A KEY" appeared',
      'pressed A',
      '"IT WENT ON" appeared',
    ]);
    expect(outcome.driveFrames).toBeGreaterThan(0);
    // A PNG, encoded so it travels as JSON.
    const png = decodeBytes(outcome.picture!.png);
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(outcome.picture!.colours).toBeGreaterThan(1);
  }, 20_000);

  it('says a machine that cannot be measured cannot be', async () => {
    // The TRS-80 is an interpreter with no CPU beneath it, and needs no ROM.
    const outcome = await runOp.run(
      wants({ machine: 'trs80', source: '10 PRINT 1\n', profile: true }),
      cliContext(),
    );
    expect(outcome.profile).toEqual({ canProfile: false, measured: null });
  }, 20_000);

  it("refuses a schedule it cannot read as the caller's mistake, before booting", () => {
    expect(() => checkSchedule('PRESS A; win the game')).toThrow(RunError);
    expect(() => checkSchedule('PRESS A; win the game')).toThrow(
      /win the game/,
    );
  });

  it('refuses to drive a machine whose ROM is not here', async () => {
    const ctx = cliContext();
    await expect(
      runOp.run(wants({ keys: 'PRESS A' }), {
        ...ctx,
        roms: { canRun: () => false },
      }),
    ).rejects.toThrow(/no ROM/);
  });

  it('refuses to drive on the root the caller named, not on the one it found', async () => {
    // As for check: the host's context carries no root, so --rom-root has to
    // reach the probe through the input or a driven run goes ahead against a
    // directory it will not read from.
    await expect(
      runOp.run(wants({ keys: 'PRESS A', romRoot: '/nowhere' }), cliContext()),
    ).rejects.toThrow(/no ROM/);
  });

  it('says how to get one, so the refusal is not a dead end', async () => {
    // The diagnosis on its own left the user with a true statement and nothing
    // to do about it; the remedies are the command line's, so they are named.
    const ctx = cliContext();
    const refusal = await runOp
      .run(wants({ keys: 'PRESS A' }), {
        ...ctx,
        roms: { canRun: () => false },
      })
      .then(
        () => null,
        (error: unknown) => (error as Error).message,
      );
    expect(refusal).toContain('roms accept');
    expect(refusal).toContain('--rom-root');
  });
});

/**
 * A run told where to stop.
 *
 * Breakpoints have to be in place before the program starts, so a run is where
 * the first ones arrive - and this is the one-shot runner, which disposes its
 * machine afterwards, so what it proves is that the stop happened and that the
 * three ways a run can finish are told apart. That the machine is left *there*
 * is a fact about the runner that holds one, and `src/mcp/session.test.ts`
 * proves it of that one.
 */
describe('running a program that is going to stop', () => {
  const COUNTING =
    '10 LET A=0\n' +
    '20 LET A=A+1\n' +
    '30 IF A<4 THEN GOTO 20\n' +
    '40 PRINT A\n';

  it('stops before the line it was told to, with the program part-way through', async () => {
    const outcome = await runOp.run(
      wants({ source: COUNTING, breakpoints: [30], variables: true }),
      cliContext(),
    );

    expect(outcome.stoppedAt).toBe(30);
    // The variables are the ones that line was reached with, not the ones the
    // program would have ended on.
    expect(outcome.variables?.variables).toContainEqual(
      expect.objectContaining({ name: 'A', value: '1' }),
    );
  }, 20_000);

  it('tells the three ways a run can finish apart without reading prose', async () => {
    const stopped = await runOp.run(
      wants({ source: COUNTING, breakpoints: [30] }),
      cliContext(),
    );
    const finished = await runOp.run(wants({ source: COUNTING }), cliContext());
    const capped = await runOp.run(
      wants({ source: '10 GOTO 10\n', maxFrames: 30 }),
      cliContext(),
    );

    expect([stopped.stoppedAt, stopped.ended]).toEqual([30, false]);
    expect([finished.stoppedAt, finished.ended]).toEqual([null, true]);
    expect([capped.stoppedAt, capped.ended]).toEqual([null, false]);
  }, 40_000);

  it('ends as it would have when the line it was told to stop before is never reached', async () => {
    const asked = await runOp.run(
      wants({ source: COUNTING, breakpoints: [999] }),
      cliContext(),
    );
    const plain = await runOp.run(wants({ source: COUNTING }), cliContext());

    expect(asked.stoppedAt).toBeNull();
    expect(asked.ended).toBe(true);
    // The same run, in the machine's own time as well as on its screen: a
    // caller pays nothing for a stop it never reaches.
    expect(asked.screen?.lines).toEqual(plain.screen?.lines);
    expect(asked.frames).toBe(plain.frames);
  }, 40_000);

  it('refuses a stop on a machine whose ROM is not here, before anything runs', async () => {
    const ctx = cliContext();
    const refusal = await runOp
      .run(wants({ source: COUNTING, breakpoints: [30] }), {
        ...ctx,
        roms: { canRun: () => false },
      })
      .then(
        () => null,
        (error: unknown) => (error as Error).message,
      );
    // The caller's mistake, with the remedy the schedule's refusal already
    // names: without the ROM no BASIC line is ever reached to stop before.
    expect(refusal).toContain('no ROM');
    expect(refusal).toContain('roms accept');
  });

  it('refuses a stop on a machine that cannot be stepped, saying what it can still do', async () => {
    // The Atom keeps no readable cell for the line being executed, so a line
    // named to stop before would never be reached.
    await expect(
      runOp.run(
        wants({ machine: 'atom', source: COUNTING, breakpoints: [30] }),
        cliContext(),
      ),
    ).rejects.toThrow(/cannot be stepped/);
  });
});
