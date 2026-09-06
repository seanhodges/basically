import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROM_ROOT_VARIABLE, romRootFor, withRomRoot } from './romRoot';

/**
 * The precedence, one test per step, because each step is a different user:
 * one saying it on this run, one who said it once when they installed, and one
 * who has a checkout and never said it at all.
 */
describe('where an installation reads ROMs from', () => {
  it('takes the option named on this run', () => {
    expect(
      romRootFor('/roms/here', { [ROM_ROOT_VARIABLE]: '/roms/said' }),
    ).toBe(path.resolve('/roms/here'));
  });

  it('takes what the installation was told when no option was named', () => {
    expect(romRootFor(undefined, { [ROM_ROOT_VARIABLE]: '/roms/said' })).toBe(
      path.resolve('/roms/said'),
    );
  });

  it('answers nothing when neither was said, leaving the upward walk to look', () => {
    expect(romRootFor(undefined, {})).toBeUndefined();
  });

  it('reads a blank variable as nothing said, not as the root directory', () => {
    expect(
      romRootFor(undefined, { [ROM_ROOT_VARIABLE]: '   ' }),
    ).toBeUndefined();
  });

  it('resolves what it answers, so no relative path crosses to the host', () => {
    const answer = romRootFor('roms', {})!;
    expect(path.isAbsolute(answer)).toBe(true);
    expect(answer).toBe(path.resolve('roms'));
  });

  it('leaves an input alone when there is no root to fold into it', () => {
    const input = { machine: 'zx81' };
    expect(withRomRoot(input, {})).toBe(input);
  });

  it('folds the root in beside whatever else the input carries', () => {
    expect(
      withRomRoot({ machine: 'zx81' }, { [ROM_ROOT_VARIABLE]: '/roms/said' }),
    ).toEqual({ machine: 'zx81', romRoot: path.resolve('/roms/said') });
  });
});
