import { describe, expect, it } from 'vitest';
import { parseDriveScript } from '../app/driveScript';
import { extractExpectations } from '../ai/codeExtractor';
import { cliContext } from '../cli/roms';
import { checkOp } from './check';

/**
 * The two callers held to one verdict.
 *
 * What the assistant states in a `basic-expect` block and what a file of
 * expectations holds on the command line are the same lines: one parser reads
 * them and one evaluator judges them, so the same file cannot mean two things.
 */

/**
 * Prints, holds it long enough to be seen, clears, and prints something else.
 * The loop is what makes the first line transient rather than instantaneous:
 * without it there is no moment at which waiting and expecting differ.
 */
const PROGRAM =
  '10 PRINT "FLASH"\n20 FOR I=1 TO 40\n30 NEXT I\n40 CLS\n50 PRINT "DONE"\n';

const check = (expectations: string) =>
  checkOp.run({ machine: 'zx81', source: PROGRAM, expectations }, cliContext());

describe('one vocabulary, whoever wrote it', () => {
  it('reads a block and a file of expectations into the same schedule', () => {
    const file = 'WAIT FOR "FLASH"\nEXPECT NOT "DONE"\nWAIT END\nEXPECT "DONE"';
    const block = ['```basic-expect', file, '```'].join('\n');
    expect(extractExpectations(block)).toEqual(parseDriveScript(file));
  });

  it('holds an expectation about transient text when it is waited for', async () => {
    // The wait already means "run until this appears, and fail if it never
    // does", which is how "it printed this at some point" is said.
    const outcome = await check(
      'WAIT FOR "FLASH"\nWAIT END 900\nEXPECT "DONE"',
    );
    expect(outcome.passed).toBe(true);
  }, 20_000);

  it('does not hold the same expectation without the wait', async () => {
    // The behaviour the one evaluation path costs: the screen is not
    // remembered on the assistant's behalf, so text the program has cleared is
    // gone by the end of the run. The rules it is given say to wait.
    const outcome = await check('WAIT END 900\nEXPECT "FLASH"');
    expect(outcome.passed).toBe(false);
    expect(outcome.steps.at(-1)!.detail).toContain('"FLASH" is not on the');
  }, 20_000);

  it('reaches the same verdict for a file written in either vocabulary', async () => {
    // The spelling a saved conversation carries and the one taught now say the
    // same thing, judged the same way.
    const now = await check('WAIT END 900\nEXPECT "DONE"\nEXPECT VAR I = 41');
    const earlier = await check(
      'WAIT END 900\nSCREEN CONTAINS "DONE"\nVAR I = 41',
    );
    expect(now.passed).toBe(earlier.passed);
    expect(now.steps.map((s) => s.outcome)).toEqual(
      earlier.steps.map((s) => s.outcome),
    );
  }, 30_000);
});
