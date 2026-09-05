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
      input: {},
    });
    expect(parseArgs(['info', 'zx81'])).toEqual({
      operation: 'info',
      json: false,
      input: { machine: 'zx81' },
    });
    expect(parseArgs(['lint', 'prog.bas', '-m', 'zx81', '--json'])).toEqual({
      operation: 'lint',
      program: { kind: 'file', path: 'prog.bas' },
      json: true,
      input: { machine: 'zx81' },
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
      out: '/tmp/prog.p',
      input: {
        machine: 'zx81',
        fileName: '/tmp/prog.p',
        target: 'p',
        programName: 'GAME',
      },
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
        '--profile',
        '--time',
        '--variables',
        '--rom-root',
        '/elsewhere/public',
      ]),
    ).toEqual({
      operation: 'run',
      program: { kind: 'file', path: 'prog.bas' },
      json: false,
      hold: false,
      screenshot: '/tmp/bbc.png',
      input: {
        machine: 'bbcmicro',
        frames: 500,
        maxFrames: 900,
        screenText: true,
        screenshot: true,
        profile: true,
        time: true,
        variables: true,
        romRoot: '/elsewhere/public',
      },
    });
    for (const operation of ['lsp', 'mcp'] as const) {
      expect(parseArgs([operation, '--stdio', '-m', 'zx81'])).toEqual({
        operation,
        stdio: true,
        machine: 'zx81',
      });
    }
  });

  it('takes no machine at all for a server, since its client may name one later', () => {
    // The editor sets `basically.machine` once it has started; an agent says
    // which machine it means on the request. Neither is the caller's mistake
    // at the point the server is started.
    for (const operation of ['lsp', 'mcp'] as const) {
      expect(parseArgs([operation, '--stdio'])).toEqual({
        operation,
        stdio: true,
        machine: undefined,
      });
    }
  });

  it('takes no machine for lint/build, leaving it to the program to declare one', () => {
    expect(parseArgs(['lint', 'prog.bas'])).toEqual({
      operation: 'lint',
      program: { kind: 'file', path: 'prog.bas' },
      json: false,
      input: { machine: undefined },
    });
    expect(parseArgs(['build', 'prog.bas', '--out', '/tmp/prog.p'])).toEqual({
      operation: 'build',
      program: { kind: 'file', path: 'prog.bas' },
      out: '/tmp/prog.p',
      input: {
        machine: undefined,
        fileName: '/tmp/prog.p',
        target: undefined,
        programName: undefined,
      },
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

  it('reports the screen as text unless only something else was asked for', () => {
    const text = (argv: string[]) => {
      const args = parseArgs(argv);
      if (args.operation !== 'run') throw new Error('not a run');
      return args.input.screenText;
    };
    expect(text(['run', '-m', 'zx81'])).toBe(true);
    expect(text(['run', '-m', 'zx81', '--screenshot', 'a.png'])).toBe(false);
    expect(
      text(['run', '-m', 'zx81', '--screenshot', 'a.png', '--screen-text']),
    ).toBe(true);
    // A measurement asked for alone is the answer, as a picture alone is.
    expect(text(['run', '-m', 'zx81', '--profile'])).toBe(false);
    expect(text(['run', '-m', 'zx81', '--time', '--screen-text'])).toBe(true);
  });

  it('refuses what the caller got wrong', () => {
    const cases: [string, string[]][] = [
      ['an unknown operation', ['dance', '-m', 'zx81']],
      ['an unknown option', ['lint', '-m', 'zx81', '--loudly']],
      ['an unknown option on lsp', ['lsp', '--stdio', '--loudly']],
      ['a positional argument on lsp', ['lsp', '--stdio', 'prog.bas']],
      ['an unknown option on mcp', ['mcp', '--stdio', '--loudly']],
      ['a positional argument on mcp', ['mcp', '--stdio', 'prog.bas']],
      ['a missing machine on run', ['run', 'prog.bas']],
      ['a missing output path', ['build', 'prog.bas', '-m', 'zx81']],
      ['a non-numeric frame count', ['run', '-m', 'zx81', '--frames', 'lots']],
      ['a fractional frame count', ['run', '-m', 'zx81', '--frames', '1.5']],
      ['an option with no value', ['lint', 'prog.bas', '-m']],
      ['no machine to describe', ['info']],
      [
        'a cap on a wait a schedule already sets',
        ['run', '-m', 'zx81', '--keys', 'PRESS A', '--max-frames', '100'],
      ],
      ['two programs', ['lint', 'a.bas', 'b.bas', '-m', 'zx81']],
    ];
    for (const [what, argv] of cases) {
      expect(() => parseArgs(argv), what).toThrow(RunError);
    }
  });

  it('takes a schedule of what to press, verbatim', () => {
    const args = parseArgs([
      'run',
      'prog.bas',
      '-m',
      'zx81',
      '--keys',
      'WAIT FOR "GO"; PRESS A',
      '--frames',
      '20',
    ]);
    if (args.operation !== 'run') throw new Error('not a run');
    // Handed on as written: what a line means is the schedule parser's
    // business, not the grammar's.
    expect(args.input.keys).toBe('WAIT FOR "GO"; PRESS A');
    expect(args.input.frames).toBe(20);
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

describe('holding a machine between commands', () => {
  it('leaves the machine up only when asked to', () => {
    const plain = parseArgs(['run', 'prog.bas', '-m', 'zx81']);
    const held = parseArgs(['run', 'prog.bas', '-m', 'zx81', '--hold']);
    expect(plain).toMatchObject({ operation: 'run', hold: false });
    expect(held).toMatchObject({ operation: 'run', hold: true });
  });

  it('parses each operation that acts on the machine that is up', () => {
    expect(parseArgs(['look'])).toEqual({
      operation: 'look',
      json: false,
      input: {},
    });
    expect(parseArgs(['drive', 'PRESS A; WAIT END'])).toEqual({
      operation: 'drive',
      json: false,
      input: { script: 'PRESS A; WAIT END' },
    });
    expect(parseArgs(['profile', '--json'])).toEqual({
      operation: 'profile',
      json: true,
      input: {},
    });
    expect(parseArgs(['screenshot', 'shot.png'])).toEqual({
      operation: 'screenshot',
      json: false,
      out: 'shot.png',
      input: {},
    });
    expect(parseArgs(['expect', 'checks.txt'])).toEqual({
      operation: 'expect',
      json: false,
      expectations: { kind: 'file', path: 'checks.txt' },
      input: {},
    });
  });

  it('takes the picture path either way round', () => {
    expect(parseArgs(['screenshot', '-o', 'a.png'])).toMatchObject({
      out: 'a.png',
    });
    expect(parseArgs(['screenshot', 'a.png'])).toMatchObject({ out: 'a.png' });
  });

  it('reads expectations from standard input when asked', () => {
    expect(parseArgs(['expect', '-'])).toMatchObject({
      expectations: { kind: 'stdin' },
    });
    expect(parseArgs(['expect'])).toMatchObject({
      expectations: { kind: 'stdin' },
    });
  });

  it('refuses an operation on a machine an argument it has no use for', () => {
    expect(() => parseArgs(['look', 'prog.bas'])).toThrow(/takes no arguments/);
    expect(() => parseArgs(['profile', '-m', 'zx81'])).toThrow();
    expect(() => parseArgs(['drive'])).toThrow(/wants one schedule/);
  });
});

describe('asking after the host', () => {
  it('defaults to reporting its status', () => {
    expect(parseArgs(['server'])).toEqual({
      operation: 'server',
      action: 'status',
      json: false,
    });
  });

  it('takes start, stop and status', () => {
    for (const action of ['start', 'stop', 'status'] as const) {
      expect(parseArgs(['server', action])).toMatchObject({ action });
    }
  });

  it('refuses anything else, naming what it takes', () => {
    expect(() => parseArgs(['server', 'restart'])).toThrow(
      /takes start, stop or status/,
    );
  });
});
