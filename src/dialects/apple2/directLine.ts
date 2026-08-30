// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  DEFAULT_HIMEM,
  DEFAULT_LOMEM,
  MAX_HIMEM,
  MAX_INT,
  MIN_LOMEM,
} from './addresses';

/**
 * The lines an Apple II listing writes without a line number.
 *
 * Integer BASIC has eleven commands the interpreter takes only at the `>`
 * prompt - typed inside a numbered line every one answers `*** SYNTAX ERR` -
 * plus `LIST`, which is legal in both places and so is accepted here too. A
 * listing writes them on a line of their own, usually as a preamble that clears
 * the machine and sizes the workspace before the program:
 *
 * ```
 * NEW
 * HIMEM:16384
 * 10 PRINT "HI"
 * ```
 *
 * and often closes with a bare `RUN`.
 *
 * This parses one physical line of that kind. It is deliberately separate from
 * `tokenizer.ts`: the block/program collision lint needs the workspace a
 * listing asks for on every lint pass, and re-tokenizing a whole program to
 * learn it would be far too much work for a keystroke.
 *
 * Only `LOMEM:` and `HIMEM:` change what the IDE builds. The others describe a
 * typing session rather than a program - what is stored is already erased,
 * holds no variables, and is started for the user - so they are accepted, kept
 * and otherwise ignored. That is a deliberate choice rather than an oversight:
 * an error of any kind, even a non-fatal one, blocks the Play button (see
 * `countProgramErrors`), and refusing to run an authentic listing because it
 * ends with `RUN` would defeat the point of reading one.
 */

/** The twelve commands, as the interpreter spells them. */
export const DIRECT_COMMANDS = [
  'HIMEM:',
  'LOMEM:',
  'AUTO',
  'LIST',
  'LOAD',
  'SAVE',
  'CLR',
  'CON',
  'DEL',
  'MAN',
  'NEW',
  'RUN',
] as const;

export type DirectCommand = (typeof DIRECT_COMMANDS)[number];

/** One accepted unnumbered line. */
export interface DirectLine {
  command: DirectCommand;
  /** Operands as written: `[]` for NEW, `[16384]` for HIMEM:16384. */
  args: number[];
  /** 0-based column of the command word within the physical line. */
  column: number;
  /** 0-based column just past the end of the line's text. */
  endColumn: number;
}

/**
 * What a physical line turned out to be.
 *
 * `none` means it is not one of these commands at all, and the caller reports
 * it as a line missing its number. `error` means it opened with one but its
 * operands are wrong, which is a fault in the line rather than a missing
 * number, so it is reported where it was read.
 */
export type DirectLineResult =
  | { kind: 'none' }
  | { kind: 'line'; line: DirectLine }
  | { kind: 'error'; message: string; column: number; endColumn: number };

/** The bounds of the area a program and its variables share. */
export interface Workspace {
  /** Bottom of the workspace: the first byte of the variable table. */
  lomem: number;
  /** Top of the workspace, exclusive; program text grows down from here. */
  himem: number;
  /** True when the listing set either bound itself. */
  declared: boolean;
}

/** The workspace a 48K machine cold-starts with. */
export const STOCK_WORKSPACE: Workspace = {
  lomem: DEFAULT_LOMEM,
  himem: DEFAULT_HIMEM,
  declared: false,
};

/**
 * Each command as a pattern that tolerates spaces inside it.
 *
 * The interpreter skips spaces everywhere outside a string literal and a REM
 * body, so `HIMEM : 20000` and `HIMEM:20000` are the same line to it - typed at
 * the machine, both leave HIMEM at `$4E20`. Matching the spelling literally
 * would refuse the spaced form a printed listing often uses.
 */
const PATTERNS: Record<DirectCommand, RegExp> = Object.fromEntries(
  DIRECT_COMMANDS.map((word) => [
    word,
    new RegExp(
      `^${[...word].map((c) => c.replace(/[:]/, '\\$&')).join('\\s*')}`,
      'i',
    ),
  ]),
) as Record<DirectCommand, RegExp>;

/** How many operands each command takes, as `[required, optional]`. */
const ARITY: Record<DirectCommand, [number, number]> = {
  'HIMEM:': [1, 0],
  'LOMEM:': [1, 0],
  AUTO: [1, 1],
  LIST: [0, 2],
  LOAD: [0, 0],
  SAVE: [0, 0],
  CLR: [0, 0],
  CON: [0, 0],
  DEL: [1, 1],
  MAN: [0, 0],
  NEW: [0, 0],
  RUN: [0, 1],
};

/**
 * Parse one physical source line as an unnumbered prompt command.
 *
 * Matching is greedy and case-insensitive, as the ROM's crunching is - but the
 * operands have to parse too, which is what stops `RUNNING` reading as `RUN`
 * followed by a variable, and `HIMEM=4096` (the Apple I's spelling, with `=`
 * instead of `:`) from being taken for the command it is not.
 */
export function parseDirectLine(lineText: string): DirectLineResult {
  const text = lineText.replace(/\r$/, '');
  const indent = text.length - text.trimStart().length;
  const body = text.slice(indent);
  let command: DirectCommand | undefined;
  let matched = '';
  for (const word of DIRECT_COMMANDS) {
    const m = PATTERNS[word].exec(body);
    if (m) {
      command = word;
      matched = m[0];
      break;
    }
  }
  if (!command) return { kind: 'none' };

  const endColumn = text.trimEnd().length;
  const fault = (message: string): DirectLineResult => ({
    kind: 'error',
    message,
    column: indent,
    endColumn,
  });

  const rest = body.slice(matched.length);
  const [required, optional] = ARITY[command];
  const args: number[] = [];

  if (rest.trim() !== '') {
    // Operands are decimal, optionally signed, separated by commas. Integer
    // BASIC has no hexadecimal, so anything else is not this command. A
    // negative is how the top of memory is written: constants stop at 32767, so
    // `HIMEM:-16384` is what claims all 48K, and it leaves HIMEM at $C000.
    const parts = rest.split(',');
    for (const part of parts) {
      const digits = part.trim();
      if (!/^-?[0-9]+$/.test(digits)) {
        // A word that merely begins with a command is an ordinary line that
        // happens to start the same way - `RUNNING`, `LISTA`, `NEWLINE`.
        if (/^[A-Za-z0-9]/.test(rest)) return { kind: 'none' };
        return fault(`${command} does not take ${digits || 'that'}`);
      }
      const value = Number(digits);
      if (Math.abs(value) > MAX_INT) {
        return fault(
          `${digits} is outside -${MAX_INT}..${MAX_INT}; Integer BASIC has no larger number`,
        );
      }
      args.push(value < 0 ? value + 0x10000 : value);
    }
  }

  if (args.length < required) {
    return fault(
      `${command} needs ${required === 1 ? 'a number' : `${required} numbers`}`,
    );
  }
  if (args.length > required + optional) {
    return fault(
      optional + required === 0
        ? `${command} takes no arguments`
        : `${command} takes at most ${required + optional}`,
    );
  }

  return { kind: 'line', line: { command, args, column: indent, endColumn } };
}

/** True when this line is one the machine takes without a line number. */
export function isDirectLine(lineText: string): boolean {
  return parseDirectLine(lineText).kind === 'line';
}

/**
 * The key {@link Dialect.unnumberedLineKey} answers with: the command a line
 * commands, so that two spellings of the same one merge rather than doubling.
 */
export function apple2UnnumberedLineKey(lineText: string): string | null {
  const parsed = parseDirectLine(lineText);
  return parsed.kind === 'line' ? parsed.line.command : null;
}

/** Why a declared pair of bounds is one the machine could not keep. */
export function workspaceFault(lomem: number, himem: number): string | null {
  if (lomem < MIN_LOMEM) {
    return `LOMEM:${lomem} would start the workspace below $0800, where text page 1 and the monitor's line buffer are; the machine accepts it and then prints over the variables, so ${MIN_LOMEM} is the lowest it can keep`;
  }
  if (himem > MAX_HIMEM) {
    return `HIMEM:${himem} is above the ${MAX_HIMEM} bytes of RAM fitted; there is nothing above $BFFF to claim`;
  }
  if (himem <= lomem) {
    return `HIMEM must be above LOMEM; ${himem} over ${lomem} leaves no workspace at all`;
  }
  return null;
}

/**
 * The workspace a listing asks for, reading only its unnumbered lines.
 *
 * Later declarations win, because each one overwrites the pointer as it is
 * typed. Bounds the machine could not keep are ignored here and the stock pair
 * returned instead - the tokenizer is what reports them, and this is called on
 * the lint path, where a caller wants an answer it can safely build with.
 */
export function declaredWorkspace(source: string): Workspace {
  let lomem: number | null = null;
  let himem: number | null = null;
  for (const raw of source.split('\n')) {
    if (/^\s*\d/.test(raw)) continue;
    const parsed = parseDirectLine(raw);
    if (parsed.kind !== 'line') continue;
    if (parsed.line.command === 'LOMEM:') lomem = parsed.line.args[0]!;
    if (parsed.line.command === 'HIMEM:') himem = parsed.line.args[0]!;
  }
  if (lomem === null && himem === null) return STOCK_WORKSPACE;

  const declared = {
    lomem: lomem ?? DEFAULT_LOMEM,
    himem: himem ?? DEFAULT_HIMEM,
    declared: true,
  };
  return workspaceFault(declared.lomem, declared.himem)
    ? STOCK_WORKSPACE
    : declared;
}

/**
 * The `LOMEM:`/`HIMEM:` lines that restate a workspace, in the order a listing
 * writes them. Empty for the stock pair, which needs no saying.
 *
 * An address above 32767 is written as the negative the interpreter accepts,
 * because that is the only form a constant can take. `$8000` is the one address
 * with no literal at all - it is 32768 either way round, and both answer
 * `*** >32767 ERR` - which is also why {@link parseDirectLine} never produces
 * it and this is never asked for it.
 */
export function workspacePreamble(lomem: number, himem: number): string[] {
  const out: string[] = [];
  const signed = (address: number): number =>
    address > MAX_INT ? address - 0x10000 : address;
  if (lomem !== DEFAULT_LOMEM) out.push(`LOMEM:${signed(lomem)}`);
  if (himem !== DEFAULT_HIMEM) out.push(`HIMEM:${signed(himem)}`);
  return out;
}
