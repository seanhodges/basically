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
        roms: { present: () => false },
      }),
    ).rejects.toThrow(/no ROM/);
  });
});
