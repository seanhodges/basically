import { describe, expect, it } from 'vitest';
import { cliContext } from '../cli/roms';
import { RunError } from '../dialects/headless/runError';
import { checkOp, type CheckInput } from './check';

/**
 * A program checked headlessly against a real machine. The ZX81 because it is
 * the cheapest machine to boot that can report both its screen and its
 * variables, which is what a verdict is read from.
 */

const wants = (over: Partial<CheckInput>): CheckInput => ({
  machine: 'zx81',
  source: '10 LET A=42\n20 PRINT "TOTAL ";A\n',
  expectations: 'WAIT END\nEXPECT "TOTAL 42"',
  ...over,
});

describe('checking a program', () => {
  it('passes a file whose every action succeeds and every expectation holds', async () => {
    const outcome = await checkOp.run(
      wants({
        expectations:
          'WAIT END\nEXPECT "TOTAL 42"\nEXPECT NOT "ERROR"\n' +
          'EXPECT STOPPED\nEXPECT VAR A = 42',
      }),
      cliContext(),
    );

    expect(outcome.errors).toEqual([]);
    expect(outcome.passed).toBe(true);
    expect(checkOp.failed!(outcome)).toBe(false);
    expect(outcome.steps.map((s) => s.outcome)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
    ]);
  }, 20_000);

  it('fails at the expectation that did not hold, by its line, with the screen', async () => {
    const outcome = await checkOp.run(
      wants({
        expectations:
          'WAIT END\n# the program prints no such thing\nEXPECT "NEVER PRINTED"',
      }),
      cliContext(),
    );

    expect(outcome.passed).toBe(false);
    const failed = outcome.steps.find((s) => s.outcome === 'failed')!;
    // The line as the caller wrote it, comment and all, so they can find it.
    expect(failed.action.line).toBe(3);
    expect(failed.detail).toContain('"NEVER PRINTED" is not on the screen');
    // What the program produced instead, so the caller can see it.
    expect(outcome.screen?.lines.some((l) => l.includes('TOTAL 42'))).toBe(
      true,
    );
  }, 20_000);

  it('judges what a variable holds', async () => {
    const wrong = await checkOp.run(
      wants({ expectations: 'WAIT END\nEXPECT VAR A = 41' }),
      cliContext(),
    );
    expect(wrong.passed).toBe(false);
    expect(wrong.steps.at(-1)!.detail).toContain('holds 42, not 41');
  }, 20_000);

  it('counts an expectation only the assistant can settle as neither', async () => {
    const outcome = await checkOp.run(
      wants({
        expectations: 'WAIT END\nEXPECT SHOWS a total\nEXPECT "TOTAL 42"',
      }),
      cliContext(),
    );

    // Reported rather than refused, so one file of expectations can be
    // written for either caller.
    expect(outcome.passed).toBe(true);
    expect(outcome.unevaluated).toBe(1);
  }, 20_000);

  it('refuses a line it cannot read before anything boots', async () => {
    await expect(
      checkOp.run(
        wants({ expectations: 'WAIT END\nsomehow win the game' }),
        cliContext(),
      ),
    ).rejects.toThrow(RunError);
    await expect(
      checkOp.run(
        wants({ expectations: 'WAIT END\nsomehow win the game' }),
        cliContext(),
      ),
    ).rejects.toThrow(/line 2/);
  });

  it('refuses a machine whose ROM is not here, rather than checking a notice', async () => {
    // A ROM-less machine draws its missing-image notice, against which every
    // expectation would fail; a verdict from it says nothing about the program.
    await expect(
      checkOp.run(
        wants({ machine: 'zx81', romRoot: '/nowhere' }),
        cliContext('/nowhere'),
      ),
    ).rejects.toThrow(/no ROM/);
  });

  it('refuses on the root the caller named, not on the one it found', async () => {
    // The regression this guards. A host builds its context knowing nothing
    // about the call, so the probe used to answer from whatever ROMs it could
    // find on disk while the run went to --rom-root - and a check against a
    // directory with no ROMs ran anyway, reaching a verdict about a machine
    // that drew its missing-image notice. The context here is built the way a
    // host builds it: with no root of its own.
    await expect(
      checkOp.run(
        wants({ machine: 'zx81', romRoot: '/nowhere' }),
        cliContext(),
      ),
    ).rejects.toThrow(/no ROM/);
  });

  it('says how to get one, so the refusal is not a dead end', async () => {
    // The diagnosis on its own left the user with a true statement and nothing
    // to do about it; the remedies are the command line's, so they are named.
    const refusal = await checkOp
      .run(
        wants({ machine: 'zx81', romRoot: '/nowhere' }),
        cliContext('/nowhere'),
      )
      .then(
        () => null,
        (error: unknown) => (error as Error).message,
      );
    expect(refusal).toContain('roms accept');
    expect(refusal).toContain('--rom-root');
  });

  it('reports a program that cannot be built as failed, without a verdict', async () => {
    const outcome = await checkOp.run(
      wants({ source: '10 PRINT "\n', expectations: 'EXPECT "HI"' }),
      cliContext(),
    );
    expect(outcome.errors.length).toBeGreaterThan(0);
    expect(outcome.passed).toBe(false);
  }, 20_000);
});
