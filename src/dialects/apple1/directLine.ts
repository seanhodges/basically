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
 * The lines an Apple I listing writes without a line number.
 *
 * Integer BASIC has nine commands the interpreter takes only at the `>` prompt
 * - typed inside a numbered line every one answers `*** SYNTAX ERR` - so a
 * listing writes them on a line of their own. The usual shape is a preamble
 * that clears the machine and sizes the workspace before the program:
 *
 * ```
 * SCR
 * LOMEM=768
 * HIMEM=4096
 * 10 PRINT "HI"
 * ```
 *
 * and a listing often closes with a bare `RUN`.
 *
 * This parses one physical line of that kind. It is deliberately separate from
 * `tokenizer.ts`: the block/program collision lint needs the workspace a
 * listing asks for on every lint pass, and re-tokenizing a whole program to
 * learn it would be far too much work for a keystroke.
 *
 * Only `LOMEM=` and `HIMEM=` change what the IDE builds. The other seven
 * describe a typing session rather than a program - what is stored is already
 * scratched, holds no variables, and is started for the user - so they are
 * accepted, kept and otherwise ignored. That is a deliberate choice rather than
 * an oversight: an error of any kind, even a non-fatal one, blocks the Play
 * button (see `countProgramErrors`), and refusing to run an authentic listing
 * because it ends with `RUN` would defeat the point of reading one.
 */

/** The nine commands, as the interpreter spells them. */
export const DIRECT_COMMANDS = [
  'HIMEM=',
  'LOMEM=',
  'AUTO',
  'LIST',
  'CLR',
  'DEL',
  'OFF',
  'RUN',
  'SCR',
] as const;

export type DirectCommand = (typeof DIRECT_COMMANDS)[number];

/** One accepted unnumbered line. */
export interface DirectLine {
  command: DirectCommand;
  /** Operands as written: `[]` for SCR, `[768]` for LOMEM=768, `[10, 20]` for DEL 10,20. */
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

/** The workspace a machine gets when nothing asks for another. */
export const STOCK_WORKSPACE: Workspace = {
  lomem: DEFAULT_LOMEM,
  himem: DEFAULT_HIMEM,
  declared: false,
};

/**
 * Each command as a pattern that tolerates spaces inside it.
 *
 * The interpreter skips spaces everywhere outside a string literal and a REM
 * body, so `LOMEM = 768` and `LOMEM=768` are the same line to it - the same
 * reason `FORI=1TO10` stores as a spaced-out FOR. Matching the spelling
 * literally would refuse the spaced form a printed listing often uses.
 */
const PATTERNS: Record<DirectCommand, RegExp> = Object.fromEntries(
  DIRECT_COMMANDS.map((word) => [
    word,
    new RegExp(
      `^${[...word].map((c) => c.replace(/[=]/, '\\$&')).join('\\s*')}`,
      'i',
    ),
  ]),
) as Record<DirectCommand, RegExp>;

/** How many operands each command takes, as `[required, optional]`. */
const ARITY: Record<DirectCommand, [number, number]> = {
  'HIMEM=': [1, 0],
  'LOMEM=': [1, 0],
  AUTO: [1, 1],
  LIST: [0, 2],
  CLR: [0, 0],
  DEL: [1, 1],
  OFF: [0, 0],
  RUN: [0, 1],
  SCR: [0, 0],
};

/**
 * Parse one physical source line as an unnumbered direct-mode command.
 *
 * Spaces are skipped the way the interpreter skips them everywhere outside a
 * string, so `LOMEM = 768` reads the same as `LOMEM=768`. Matching is greedy
 * and case-insensitive, as the ROM's crunching is - but the operands have to
 * parse too, which is what stops `RUNNING` reading as `RUN` followed by a
 * variable, and `LOMEM 768` (the Apple II's spelling, without the `=`) from
 * being taken for the command it is not.
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
    // Operands are unsigned decimal, separated by commas. Integer BASIC has no
    // hexadecimal and no sign here, so anything else is not this command.
    const parts = rest.split(',');
    for (const part of parts) {
      const digits = part.trim();
      if (!/^[0-9]+$/.test(digits)) {
        // A word that merely begins with a command is an ordinary line that
        // happens to start the same way - `RUNNING`, `SCREEN`, `LISTA`.
        if (/^[A-Za-z0-9]/.test(rest)) return { kind: 'none' };
        return fault(`${command} does not take ${digits || 'that'}`);
      }
      const value = Number(digits);
      if (value > MAX_INT) {
        return fault(
          `${digits} is over ${MAX_INT}; Integer BASIC has no larger number`,
        );
      }
      args.push(value);
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
export function apple1UnnumberedLineKey(lineText: string): string | null {
  const parsed = parseDirectLine(lineText);
  return parsed.kind === 'line' ? parsed.line.command : null;
}

/** Why a declared pair of bounds is one the machine could not hold. */
export function workspaceFault(lomem: number, himem: number): string | null {
  if (lomem < MIN_LOMEM) {
    return `LOMEM=${lomem} would start the workspace inside the monitor's input buffer at $0200-$027F, which the next line typed overwrites; ${MIN_LOMEM} is the lowest it can go`;
  }
  if (himem > MAX_HIMEM) {
    return `HIMEM=${himem} is above the ${MAX_HIMEM} bytes of RAM an Apple I has fitted; there is nothing above $0FFF to claim`;
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
 * typed. Bounds the machine could not hold are ignored here and the stock pair
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
    if (parsed.line.command === 'LOMEM=') lomem = parsed.line.args[0]!;
    if (parsed.line.command === 'HIMEM=') himem = parsed.line.args[0]!;
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
 * The `LOMEM=`/`HIMEM=` lines that restate a workspace, in the order a listing
 * writes them. Empty for the stock pair, which needs no saying.
 *
 * This is what makes an imported image round-trip: the bounds live in the
 * dump's zero-page block, and without restating them in the recovered text the
 * program would be rebuilt into the stock workspace instead of its own.
 */
export function workspacePreamble(lomem: number, himem: number): string[] {
  const out: string[] = [];
  if (lomem !== DEFAULT_LOMEM) out.push(`LOMEM=${lomem}`);
  if (himem !== DEFAULT_HIMEM) out.push(`HIMEM=${himem}`);
  return out;
}
