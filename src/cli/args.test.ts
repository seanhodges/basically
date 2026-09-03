import { describe, expect, it } from 'vitest';
import { OPERATIONS, parseArgs } from './args';
import { RunError } from '../dialects/headless/runListing';
import { usage } from './usage';

describe('the command line grammar', () => {
  it('names every operation in the summary, and gives each its own help', () => {
    for (const operation of OPERATIONS) {
      expect(usage(), operation).toContain(operation);
      expect(usage(operation), operation).toContain(`basically ${operation}`);
    }
  });

  it('asks for help with no operation, and for one operation with it', () => {
    expect(parseArgs([])).toEqual({ operation: 'help' });
    expect(parseArgs(['--help'])).toEqual({ operation: 'help' });
    expect(parseArgs(['-h'])).toEqual({ operation: 'help' });
    expect(parseArgs(['build', '--help'])).toEqual({
      operation: 'help',
      topic: 'build',
    });
  });

  it('parses every operation', () => {
    expect(parseArgs(['machines', '--json'])).toEqual({
      operation: 'machines',
      json: true,
    });
    expect(parseArgs(['info', 'zx81'])).toEqual({
      operation: 'info',
      machine: 'zx81',
      json: false,
    });
    expect(parseArgs(['lint', 'prog.bas', '-m', 'zx81', '--json'])).toEqual({
      operation: 'lint',
      program: { kind: 'file', path: 'prog.bas' },
      machine: 'zx81',
      json: true,
    });
    expect(
      parseArgs([
        'build',
        'prog.bas',
        '--machine',
        'zx81',
        '--out',
        '/tmp/prog.p',
        '-t',
        'p',
        '--program-name',
        'GAME',
      ]),
    ).toEqual({
      operation: 'build',
      program: { kind: 'file', path: 'prog.bas' },
      machine: 'zx81',
      out: '/tmp/prog.p',
      target: 'p',
      programName: 'GAME',
    });
    expect(
      parseArgs([
        'run',
        'prog.bas',
        '-m',
        'bbcmicro',
        '--frames',
        '500',
        '--max-frames',
        '900',
        '--screenshot',
        '/tmp/bbc.png',
        '--screen-text',
        '--rom-root',
        '/elsewhere/public',
      ]),
    ).toEqual({
      operation: 'run',
      program: { kind: 'file', path: 'prog.bas' },
      machine: 'bbcmicro',
      frames: 500,
      maxFrames: 900,
      screenText: true,
      screenshot: '/tmp/bbc.png',
      json: false,
      romRoot: '/elsewhere/public',
    });
  });

  it('reads standard input from "-" and from no path at all', () => {
    for (const argv of [
      ['lint', '-', '-m', 'zx81'],
      ['lint', '-m', 'zx81'],
    ]) {
      const args = parseArgs(argv);
      expect(args, argv.join(' ')).toMatchObject({
        program: { kind: 'stdin' },
      });
    }
  });

  it('reports the screen as text unless only a picture was asked for', () => {
    const text = (argv: string[]) => {
      const args = parseArgs(argv);
      if (args.operation !== 'run') throw new Error('not a run');
      return args.screenText;
    };
    expect(text(['run', '-m', 'zx81'])).toBe(true);
    expect(text(['run', '-m', 'zx81', '--screenshot', 'a.png'])).toBe(false);
    expect(
      text(['run', '-m', 'zx81', '--screenshot', 'a.png', '--screen-text']),
    ).toBe(true);
  });

  it('refuses what the caller got wrong', () => {
    const cases: [string, string[]][] = [
      ['an unknown operation', ['dance', '-m', 'zx81']],
      ['an unknown option', ['lint', '-m', 'zx81', '--loudly']],
      ['a missing machine', ['lint', 'prog.bas']],
      ['a missing output path', ['build', 'prog.bas', '-m', 'zx81']],
      ['a non-numeric frame count', ['run', '-m', 'zx81', '--frames', 'lots']],
      ['a fractional frame count', ['run', '-m', 'zx81', '--frames', '1.5']],
      ['an option with no value', ['lint', 'prog.bas', '-m']],
      ['no machine to describe', ['info']],
      ['two programs', ['lint', 'a.bas', 'b.bas', '-m', 'zx81']],
    ];
    for (const [what, argv] of cases) {
      expect(() => parseArgs(argv), what).toThrow(RunError);
    }
  });

  // The old grammar took a bare machine name first and ran it. Nothing accepts
  // that shape now, and a caller with the habit should be told so rather than
  // have a machine name read as an operation.
  it('reads a bare machine name as no operation at all', () => {
    expect(() => parseArgs(['commodore64'])).toThrow(/no such operation/);
    expect(() => parseArgs(['zx81', 'png', '--png', '/tmp/a.png'])).toThrow(
      RunError,
    );
  });
});
