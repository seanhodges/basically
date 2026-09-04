import { describe, expect, it } from 'vitest';
import { RunError } from '../dialects/headless/runError';
import { lintListing, lintOp } from './lint';
import { pureContext } from './testSupport';

const ctx = pureContext();
const lint = (machine: string | undefined, source: string) =>
  lintListing({ machine, source }, ctx);

// The ZX81 and the C64 are the machines here because their tokenizers already
// have colocated tests establishing what each of these listings is: this file
// checks that the check reports them, not what any dialect thinks of them.
describe('checking a program', () => {
  it('finds nothing wrong with a clean listing', () => {
    const outcome = lint('commodore64', '10 PRINT "HI"\n20 GOTO 10\n');
    expect(outcome.machine).toEqual({ id: 'commodore64', name: 'C64' });
    expect(outcome.problems).toEqual([]);
    expect(outcome.fatal).toBe(false);
  });

  it('places a real error at its line and column, and calls it fatal', () => {
    const outcome = lint('zx81', '10 PRINT "HI\n');
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
    const outcome = lint('zx81', '10 LET A=1: PRINT A\n');
    expect(outcome.problems).toHaveLength(1);
    expect(outcome.problems[0]).toMatchObject({ line: 1, fatal: false });
    expect(outcome.fatal).toBe(false);
  });

  it('refuses a machine that is not registered', () => {
    expect(() => lint('speccy-2000', '10 PRINT 1\n')).toThrow(RunError);
  });

  it('reads the machine from the program when none is named', () => {
    const outcome = lint(undefined, '#MACHINE commodore64\n10 PRINT "HI"\n');
    expect(outcome.machine).toEqual({ id: 'commodore64', name: 'C64' });
    expect(outcome.problems).toEqual([]);
  });

  it('a named machine overrides a declaration', () => {
    const outcome = lint('zx81', '#MACHINE commodore64\n10 PRINT "HI"\n');
    expect(outcome.machine.id).toBe('zx81');
  });

  it("falls back to the context's machine, after the declaration", () => {
    const pinned = pureContext({ defaultMachine: 'zx81' });
    expect(lintListing({ source: '10 PRINT "HI"\n' }, pinned).machine.id).toBe(
      'zx81',
    );
    // A program that says which machine it is for is right about that
    // whichever conversation it arrives in.
    expect(
      lintListing({ source: '#MACHINE commodore64\n10 PRINT "HI"\n' }, pinned)
        .machine.id,
    ).toBe('commodore64');
  });

  it("is the caller's mistake when nothing says which machine", () => {
    expect(() => lint(undefined, '10 PRINT "HI"\n')).toThrow(RunError);
    expect(() => lint(undefined, '10 PRINT "HI"\n')).toThrow(
      /-m <machine>.*#MACHINE/s,
    );
  });

  it("is the caller's mistake, naming the line and column, when the declaration itself is at fault", () => {
    expect(() => lint(undefined, '#MACHINE nosuchmachine\n10 PRINT\n')).toThrow(
      /^1:10: No registered machine "nosuchmachine"$/,
    );
  });

  it('tells a model each problem the way a compiler places one', () => {
    const outcome = lint('zx81', '10 X=5\n');
    expect(lintOp.describe(outcome)).toBe(
      'ZX81: 1 problem, at least one fatal.\n' +
        '1:4: error: Line must start with a statement keyword (e.g. LET, PRINT, IF…)',
    );
    expect(lintOp.describe(lint('commodore64', '10 PRINT "HI"\n'))).toBe(
      'C64: no problems.',
    );
  });
});
