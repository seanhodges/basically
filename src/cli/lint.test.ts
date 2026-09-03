import { describe, expect, it } from 'vitest';
import { formatProblems, lintListing } from './lint';
import { RunError } from '../dialects/headless/runListing';

// The ZX81 and the C64 are the machines here because their tokenizers already
// have colocated tests establishing what each of these listings is: this file
// checks that the check reports them, not what any dialect thinks of them.
describe('checking a program', () => {
  it('finds nothing wrong with a clean listing', () => {
    const outcome = lintListing('commodore64', '10 PRINT "HI"\n20 GOTO 10\n');
    expect(outcome.machine).toEqual({ id: 'commodore64', name: 'C64' });
    expect(outcome.problems).toEqual([]);
    expect(outcome.fatal).toBe(false);
  });

  it('places a real error at its line and column, and calls it fatal', () => {
    const outcome = lintListing('zx81', '10 PRINT "HI\n');
    expect(outcome.problems).toHaveLength(1);
    expect(outcome.problems[0]).toMatchObject({
      line: 1,
      column: 11,
      fatal: true,
    });
    expect(outcome.fatal).toBe(true);
  });

  // A ZX81 line carrying two statements is stored by the machine and fails only
  // when it runs, so it is reported and the check still succeeds.
  it('reports an advisory problem without failing the check', () => {
    const outcome = lintListing('zx81', '10 LET A=1: PRINT A\n');
    expect(outcome.problems).toHaveLength(1);
    expect(outcome.problems[0]).toMatchObject({ line: 1, fatal: false });
    expect(outcome.fatal).toBe(false);
  });

  it('refuses a machine that is not registered', () => {
    expect(() => lintListing('speccy-2000', '10 PRINT 1\n')).toThrow(RunError);
  });

  it('places each problem the way a compiler places one', () => {
    const { problems } = lintListing('zx81', '10 X=5\n');
    expect(formatProblems(problems)).toBe(
      '1:4: error: Line must start with a statement keyword (e.g. LET, PRINT, IF…)',
    );
    expect(
      formatProblems([{ line: 7, message: 'careful', fatal: false }]),
    ).toBe('7: warning: careful');
  });
});
