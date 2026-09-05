// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The command line's whole argument grammar, as a function over an argv array.
 *
 * Nothing here reads `process`, argv or the filesystem: the caller hands in the
 * arguments and gets back what they asked for, so the grammar is unit-testable
 * without spawning anything, and a caller other than the shell wrapper can
 * reach it.
 *
 * Every mistake a caller can make throws {@link RunError} - the listing
 * runner's own error type - so the shim has one type to map onto the exit code
 * reserved for a bad invocation.
 */

import { RunError } from '../dialects/headless/runError';
import type { BuildInput } from '../ops/build';
import type { CheckInput } from '../ops/check';
import type { ConvertInput } from '../ops/convert';
import type { InfoInput } from '../ops/info';
import type { LintInput } from '../ops/lint';
import type { MachinesInput } from '../ops/machines';
import type { DriveInput } from '../ops/drive';
import type { ExpectInput } from '../ops/expect';
import type { RunInput } from '../ops/run';

export const OPERATIONS = [
  'machines',
  'info',
  'lint',
  'build',
  'run',
  'check',
  'convert',
  // The operations that act on the machine a `run --hold` left up. Each is the
  // same operation the options on `run` and `check` reach; what differs is
  // whether there is a machine afterwards.
  'drive',
  'look',
  'screenshot',
  'profile',
  'time',
  'variables',
  'expect',
  'server',
  'lsp',
  'mcp',
] as const;

export type Operation = (typeof OPERATIONS)[number];

/** Where a program's text comes from. */
export type ProgramInput =
  /** A named file. */
  | { kind: 'file'; path: string }
  /** Standard input: the caller wrote `-`, or named no file at all. */
  | { kind: 'stdin' };

export interface HelpArgs {
  operation: 'help';
  /** The operation whose own help was asked for, or absent for the summary. */
  topic?: Operation;
}

/**
 * Each operation's arguments are the operation's own input (`src/ops/`) with
 * the program's text left for the shim to read, beside what only the command
 * line knows: where the program comes from, where a file goes, and whether
 * the answer is wanted as JSON.
 */
export interface MachinesArgs {
  operation: 'machines';
  json: boolean;
  input: MachinesInput;
}

export interface InfoArgs {
  operation: 'info';
  json: boolean;
  /** `machine` is always set: the grammar wants one. */
  input: InfoInput;
}

export interface LintArgs {
  operation: 'lint';
  program: ProgramInput;
  json: boolean;
  /** `machine` absent when the caller relies on the program's own `#MACHINE` declaration. */
  input: Omit<LintInput, 'source'>;
}

export interface BuildArgs {
  operation: 'build';
  program: ProgramInput;
  /** Where the first file produced is written; the input's `fileName`. */
  out: string;
  input: Omit<BuildInput, 'source'>;
}

export interface RunArgs {
  operation: 'run';
  /**
   * Leave the machine this run booted still running, for the operations that
   * act on one. Without it the machine is let go when the run is reported,
   * which is what a run has always done.
   */
  hold: boolean;
  program: ProgramInput;
  json: boolean;
  /** Where to write a picture of the screen, when one was asked for. */
  screenshot?: string;
  input: Omit<RunInput, 'source'>;
}

export interface CheckArgs {
  operation: 'check';
  program: ProgramInput;
  /** Where the expectations come from; the input's `expectations`. */
  expectations: ProgramInput;
  json: boolean;
  input: Omit<CheckInput, 'source' | 'expectations'>;
}

/**
 * An operation acting on the machine the command line is holding.
 *
 * None of them names a machine or reads a program: the machine is the one a
 * `run --hold` left up, and a command line holding none is told so rather than
 * booting one behind the caller's back.
 */
export interface DriveArgs {
  operation: 'drive';
  json: boolean;
  input: DriveInput;
}

export interface LookArgs {
  operation: 'look';
  json: boolean;
  input: Record<never, never>;
}

export interface ScreenshotArgs {
  operation: 'screenshot';
  json: boolean;
  /** Where the picture goes; the outcome carries its bytes for the shim. */
  out?: string;
  input: Record<never, never>;
}

export interface MeasureArgs {
  operation: 'profile' | 'time' | 'variables';
  json: boolean;
  input: Record<never, never>;
}

export interface ExpectArgs {
  operation: 'expect';
  /** Where the expectations come from. */
  expectations: ProgramInput;
  json: boolean;
  input: Omit<ExpectInput, 'expectations'>;
}

/** Asking after the host itself rather than after a program or a machine. */
export interface ServerArgs {
  operation: 'server';
  action: 'status' | 'stop' | 'start';
  json: boolean;
}

export interface ConvertArgs {
  operation: 'convert';
  /**
   * Named `file` rather than `program`: what it reads is a machine's own
   * binary, not a BASIC listing, and it is read as bytes rather than text.
   */
  file: ProgramInput;
  /** Where the recovered BASIC is written; standard output when absent. */
  out?: string;
  /** `fileName` and `base64` are filled in by the client once it has read `file`. */
  input: Omit<ConvertInput, 'base64' | 'fileName'>;
}

export interface LspArgs {
  operation: 'lsp';
  /** Serve over standard input/output; the only transport, so always set once parsed. */
  stdio: boolean;
  /**
   * A machine to bind every document to by default, absent when the editor is
   * expected to say later - see {@link ../lsp/binding}. Unlike every other
   * program-reading operation, naming none is not the caller's mistake: the
   * editor may set `basically.machine` or send it in `initializationOptions`
   * once the server has started.
   */
  machine?: string;
}

export interface McpArgs {
  operation: 'mcp';
  /** Serve over standard input/output; the only transport, so always set once parsed. */
  stdio: boolean;
  /**
   * The machine a program-reading request defaults to when it names none and
   * the program declares none, absent when the client is expected to say on
   * each request. Optional for the same reason it is optional for `lsp`: the
   * server outlives any one request, and a client may work on a machine it
   * only decides on later.
   */
  machine?: string;
}

export type CliArgs =
  | HelpArgs
  | MachinesArgs
  | InfoArgs
  | LintArgs
  | BuildArgs
  | RunArgs
  | CheckArgs
  | ConvertArgs
  | DriveArgs
  | LookArgs
  | ScreenshotArgs
  | MeasureArgs
  | ExpectArgs
  | ServerArgs
  | LspArgs
  | McpArgs;

function isOperation(word: string): word is Operation {
  return (OPERATIONS as readonly string[]).includes(word);
}

/** The one positive-integer rule every count option is held to. */
function positiveInteger(flag: string, raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new RunError(`${flag} wants a positive whole number, got "${raw}"`);
  }
  return value;
}

/**
 * Walk one operation's arguments, handing each option to `option` and
 * collecting the rest in order.
 *
 * `option` is given the spelling and a `value()` that consumes the next
 * argument, so an option that takes a value and one that does not are written
 * the same way and neither indexes argv itself. A bare `-` is a positional: it
 * is how a caller names standard input.
 */
function scan(
  argv: string[],
  option: (name: string, value: () => string) => void,
): string[] {
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('-') || arg === '-') {
      positional.push(arg);
      continue;
    }
    option(arg, () => {
      const next = argv[++i];
      if (next === undefined) throw new RunError(`${arg} wants a value`);
      return next;
    });
  }
  return positional;
}

function unknownOption(operation: Operation, name: string): RunError {
  return new RunError(
    `${operation} has no option ${name} (basically ${operation} --help lists them)`,
  );
}

function programFrom(operation: Operation, positional: string[]): ProgramInput {
  if (positional.length > 1) {
    throw new RunError(
      `${operation} takes one program, not ${positional.length}`,
    );
  }
  const path = positional[0];
  return path === undefined || path === '-'
    ? { kind: 'stdin' }
    : { kind: 'file', path };
}

function requireMachine(
  operation: Operation,
  machine: string | undefined,
): string {
  if (machine === undefined) {
    throw new RunError(
      `${operation} wants a machine: -m <machine> (basically machines lists them)`,
    );
  }
  return machine;
}

/**
 * `--json` and nothing else, for an operation whose whole input is the machine
 * that is already up.
 */
function takeJson(argv: string[], operation: Operation): boolean {
  let json = false;
  const rest = scan(argv, (name) => {
    if (name !== '--json') throw unknownOption(operation, name);
    json = true;
  });
  if (rest.length > 0) {
    throw new RunError(`${operation} takes no arguments, got "${rest[0]}"`);
  }
  return json;
}

function parseDrive(argv: string[]): DriveArgs {
  let json = false;
  const rest = scan(argv, (name) => {
    if (name !== '--json') throw unknownOption('drive', name);
    json = true;
  });
  if (rest.length !== 1) {
    throw new RunError('drive wants one schedule of actions to carry out');
  }
  return { operation: 'drive', json, input: { script: rest[0]! } };
}

function parseScreenshot(argv: string[]): ScreenshotArgs {
  let json = false;
  let out: string | undefined;
  const rest = scan(argv, (name, value) => {
    switch (name) {
      case '--json':
        json = true;
        break;
      case '-o':
      case '--out':
        out = value();
        break;
      default:
        throw unknownOption('screenshot', name);
    }
  });
  // The path may be written as `screenshot a.png` as readily as `-o a.png`.
  if (rest.length > 1) {
    throw new RunError(
      `screenshot takes one file to write, got ${rest.length}`,
    );
  }
  out ??= rest[0];
  return { operation: 'screenshot', json, out, input: {} };
}

function parseExpect(argv: string[]): ExpectArgs {
  let json = false;
  let expectations: string | undefined;
  const rest = scan(argv, (name, value) => {
    switch (name) {
      case '--json':
        json = true;
        break;
      case '-e':
      case '--expect':
        expectations = value();
        break;
      default:
        throw unknownOption('expect', name);
    }
  });
  expectations ??= rest[0];
  if (rest.length > 1) {
    throw new RunError(
      `expect takes one file of expectations, got ${rest.length}`,
    );
  }
  return {
    operation: 'expect',
    expectations:
      expectations === undefined || expectations === '-'
        ? { kind: 'stdin' }
        : { kind: 'file', path: expectations },
    json,
    input: {},
  };
}

function parseServerCommand(argv: string[]): ServerArgs {
  let json = false;
  const rest = scan(argv, (name) => {
    if (name !== '--json') throw unknownOption('server', name);
    json = true;
  });
  const action = rest[0] ?? 'status';
  if (action !== 'status' && action !== 'stop' && action !== 'start') {
    throw new RunError(`server takes start, stop or status, not "${action}"`);
  }
  if (rest.length > 1) {
    throw new RunError(`server takes one action, got "${rest[1]}"`);
  }
  return { operation: 'server', action, json };
}

function parseMachines(argv: string[]): MachinesArgs {
  let json = false;
  const rest = scan(argv, (name) => {
    if (name !== '--json') throw unknownOption('machines', name);
    json = true;
  });
  if (rest.length > 0) {
    throw new RunError(`machines takes no arguments, got "${rest[0]}"`);
  }
  return { operation: 'machines', json, input: {} };
}

function parseInfo(argv: string[]): InfoArgs {
  let json = false;
  const rest = scan(argv, (name) => {
    if (name !== '--json') throw unknownOption('info', name);
    json = true;
  });
  if (rest.length !== 1) {
    throw new RunError(
      'info wants one machine (basically machines lists them)',
    );
  }
  return { operation: 'info', json, input: { machine: rest[0]! } };
}

function parseLint(argv: string[]): LintArgs {
  let machine: string | undefined;
  let json = false;
  const rest = scan(argv, (name, value) => {
    switch (name) {
      case '-m':
      case '--machine':
        machine = value();
        break;
      case '--json':
        json = true;
        break;
      default:
        throw unknownOption('lint', name);
    }
  });
  return {
    operation: 'lint',
    program: programFrom('lint', rest),
    json,
    input: { machine },
  };
}

function parseBuild(argv: string[]): BuildArgs {
  let machine: string | undefined;
  let out: string | undefined;
  let target: string | undefined;
  let programName: string | undefined;
  const rest = scan(argv, (name, value) => {
    switch (name) {
      case '-m':
      case '--machine':
        machine = value();
        break;
      case '-o':
      case '--out':
        out = value();
        break;
      case '-t':
      case '--target':
        target = value();
        break;
      case '--program-name':
        programName = value();
        break;
      default:
        throw unknownOption('build', name);
    }
  });
  if (out === undefined) {
    throw new RunError('build wants somewhere to write: -o <path>');
  }
  return {
    operation: 'build',
    program: programFrom('build', rest),
    out,
    input: { machine, fileName: out, target, programName },
  };
}

function parseRun(argv: string[]): RunArgs {
  let machine: string | undefined;
  let frames: number | undefined;
  let maxFrames: number | undefined;
  let keys: string | undefined;
  let screenshot: string | undefined;
  let screenText = false;
  let profile = false;
  let time = false;
  let variables = false;
  let json = false;
  let hold = false;
  let romRoot: string | undefined;
  const rest = scan(argv, (name, value) => {
    switch (name) {
      case '-m':
      case '--machine':
        machine = value();
        break;
      case '--hold':
        hold = true;
        break;
      case '--frames':
        frames = positiveInteger(name, value());
        break;
      case '--max-frames':
        maxFrames = positiveInteger(name, value());
        break;
      case '--keys':
        keys = value();
        break;
      case '--screenshot':
        screenshot = value();
        break;
      case '--screen-text':
        screenText = true;
        break;
      case '--profile':
        profile = true;
        break;
      case '--time':
        time = true;
        break;
      case '--variables':
        variables = true;
        break;
      case '--json':
        json = true;
        break;
      case '--rom-root':
        romRoot = value();
        break;
      default:
        throw unknownOption('run', name);
    }
  });
  if (keys !== undefined && maxFrames !== undefined) {
    // A schedule already says how long to let the program run, and a driven run
    // ends where the schedule ends rather than waiting for the program - so a
    // cap on that wait would silently mean nothing. Refused rather than
    // ignored, so nobody writes a schedule believing the run waits after it.
    throw new RunError(
      '--max-frames means nothing with --keys: the schedule says how long to ' +
        'wait, and "WAIT END" is how it waits for the program to stop',
    );
  }
  return {
    operation: 'run',
    program: programFrom('run', rest),
    json,
    hold,
    screenshot,
    input: {
      machine: requireMachine('run', machine),
      frames,
      maxFrames,
      keys,
      // The screen's text is what a run reported before it could report
      // anything else, so it stays the answer for a caller who asked for no
      // output at all. Asking only for a picture, or only for a measurement,
      // is asking for that.
      screenText:
        screenText ||
        (screenshot === undefined && !profile && !time && !variables),
      screenshot: screenshot !== undefined,
      profile,
      time,
      variables,
      romRoot,
    },
  };
}

function parseCheck(argv: string[]): CheckArgs {
  let machine: string | undefined;
  let expectations: string | undefined;
  let json = false;
  let romRoot: string | undefined;
  const rest = scan(argv, (name, value) => {
    switch (name) {
      case '-m':
      case '--machine':
        machine = value();
        break;
      case '-e':
      case '--expect':
        expectations = value();
        break;
      case '--json':
        json = true;
        break;
      case '--rom-root':
        romRoot = value();
        break;
      default:
        throw unknownOption('check', name);
    }
  });
  if (expectations === undefined) {
    throw new RunError(
      'check wants expectations to check against: -e <path>, or "-" to read ' +
        'them from standard input',
    );
  }
  return {
    operation: 'check',
    program: programFrom('check', rest),
    // "-" is standard input here exactly as it is for a program, so a check
    // can be piped either its program or its expectations - but not both, and
    // the shim is where that is refused, since only it reads them.
    expectations:
      expectations === '-'
        ? { kind: 'stdin' }
        : { kind: 'file', path: expectations },
    json,
    input: { machine: requireMachine('check', machine), romRoot },
  };
}

function parseConvert(argv: string[]): ConvertArgs {
  let machine: string | undefined;
  let out: string | undefined;
  const rest = scan(argv, (name, value) => {
    switch (name) {
      case '-m':
      case '--machine':
        machine = value();
        break;
      case '-o':
      case '--out':
        out = value();
        break;
      default:
        throw unknownOption('convert', name);
    }
  });
  return {
    operation: 'convert',
    file: programFrom('convert', rest),
    out,
    input: { machine },
  };
}

/**
 * The two operations that serve rather than answer take the same arguments: a
 * transport and an optional machine. Neither takes a program, because a client
 * sends its own.
 */
function parseServer<T extends 'lsp' | 'mcp'>(
  operation: T,
  argv: string[],
): { operation: T; stdio: boolean; machine?: string } {
  let machine: string | undefined;
  let stdio = false;
  const rest = scan(argv, (name, value) => {
    switch (name) {
      case '-m':
      case '--machine':
        machine = value();
        break;
      case '--stdio':
        stdio = true;
        break;
      default:
        throw unknownOption(operation, name);
    }
  });
  if (rest.length > 0) {
    throw new RunError(`${operation} takes no arguments, got "${rest[0]}"`);
  }
  return { operation, stdio, machine };
}

export function parseArgs(argv: string[]): CliArgs {
  const wantsHelp = argv.includes('--help') || argv.includes('-h');
  const first = argv[0];
  if (first === undefined || first === '--help' || first === '-h') {
    return { operation: 'help' };
  }
  if (!isOperation(first)) {
    throw new RunError(
      `no such operation "${first}" (basically --help names them all)`,
    );
  }
  if (wantsHelp) return { operation: 'help', topic: first };

  const rest = argv.slice(1);
  switch (first) {
    case 'machines':
      return parseMachines(rest);
    case 'info':
      return parseInfo(rest);
    case 'lint':
      return parseLint(rest);
    case 'build':
      return parseBuild(rest);
    case 'run':
      return parseRun(rest);
    case 'check':
      return parseCheck(rest);
    case 'convert':
      return parseConvert(rest);
    case 'drive':
      return parseDrive(rest);
    case 'look':
      return { operation: 'look', json: takeJson(rest, 'look'), input: {} };
    case 'screenshot':
      return parseScreenshot(rest);
    case 'profile':
    case 'time':
    case 'variables':
      return { operation: first, json: takeJson(rest, first), input: {} };
    case 'expect':
      return parseExpect(rest);
    case 'server':
      return parseServerCommand(rest);
    case 'lsp':
      return parseServer('lsp', rest);
    case 'mcp':
      return parseServer('mcp', rest);
  }
}
