// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The characters the target machine will store as something else.
 *
 * A machine holds only the characters its own set has, and where a program uses
 * one it has not, the IDE converts silently - most often by folding a
 * lower-case letter onto its capital. The program still runs; what changes is
 * that the listing on screen is no longer the listing the machine holds, so
 * typing or pasting it into the real thing would not reproduce it. Nothing said
 * so before this.
 *
 * Not a diagnostic. `countProgramErrors` counts `dialect.lint()` with no
 * severity filter and the Run gate refuses on any non-zero count, as do the
 * share dialog and the share-compatibility filter, so anything in the error
 * list blocks. This is a derived figure instead, computed beside the program
 * statistics the status bar already shows - the same shape as the RAM readout.
 *
 * A reader who wants the refusal turns on Strict characters, which escalates
 * *these same findings* into errors ({@link ./strictCharacters}). One detection
 * either way, so the count the status bar shows and the errors the editor
 * raises can never disagree about one program.
 *
 * Each finding carries its own position as well as the total. The status bar
 * needs only the count, but a position recovered later would mean walking the
 * source twice.
 */
import type { Dialect } from '../dialects/types';
import { sourceUnitContext, unitAt } from '../dialects/sourceUnits';
import { letterCaseFor } from '../dialects/letterCase';
import { isBinaryDirective } from '../dialects/binaryDirective';

/** One character the machine will store as a different one. */
export interface ConvertedCharacter {
  /** The character as the program writes it. */
  from: string;
  /** The character the machine stores, and lists back. */
  to: string;
  /** 1-based editor line. */
  line: number;
  /** 0-based column within that line. */
  column: number;
}

/** What the open program will lose to its machine's character set. */
export interface ConversionReport {
  /** How many characters the machine will change. */
  count: number;
  /** Each one, in source order, with where it is. */
  findings: ConvertedCharacter[];
}

const EMPTY: ConversionReport = { count: 0, findings: [] };

/**
 * The control codes a Commodore listing switches character sets with, and the
 * `CHR$` calls that write the same two codes.
 *
 * Both forms because both are how these listings are written: the escapes are
 * what this IDE's own text carries, and `CHR$(14)` is what an archive listing
 * carries. A direct poke to the video chip (`POKE 53272,23`) is deliberately
 * not recognised - see {@link convertedCharacters}.
 */
const TO_LOWER_SET = 0x0e;
const TO_UPPER_SET = 0x8e;
const CHR_SET_SWITCH = /^CHR\$\(\s*(14|142)\s*\)/i;

/** The program's physical lines, less their line numbers and `#BIN` records. */
function codeLines(source: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  source.split('\n').forEach((raw, index) => {
    if (raw.trim() === '' || isBinaryDirective(raw.trim())) return;
    // The line number is stripped by *blanking* rather than by slicing, so a
    // column stays a column of the editor's own line.
    const body = raw.replace(/^(\s*)(\d+)/, (_m, ws: string, digits: string) =>
      ' '.repeat(ws.length + digits.length),
    );
    out.push({ line: index + 1, body });
  });
  return out;
}

/**
 * The characters `dialect` would store as different ones, in `source`.
 *
 * The walk goes a unit at a time through {@link ../dialects/sourceUnits}, which
 * is what exempts notation structurally rather than by a list, and which the
 * strict editor's case forcing reads the same way.
 *
 * A machine that carries its lower case in a second character set is honoured
 * in source order: lower case is not counted once the program has switched to
 * that set, and is counted again after it switches back. Three things that rule
 * does not do, all of them deliberate - it does not trace control flow, it does
 * not recognise a switch made by poking the video chip, and after a switch it
 * counts no letters at all rather than claiming to know how an upper-case one
 * would then be stored. Every one of those makes it count *less*, never more,
 * which is the direction that stays safe if these findings ever become errors.
 */
export function convertedCharacters(
  source: string,
  dialect: Dialect,
): ConversionReport {
  const ctx = sourceUnitContext(dialect);
  if (!ctx) return EMPTY;
  const switchable = letterCaseFor(dialect.id)?.lowerCase === 'switched';

  const findings: ConvertedCharacter[] = [];
  // Source order across the whole program, not per line: a program switches
  // sets on one line and prints on the next.
  let lowerSet = false;

  for (const { line, body } of codeLines(source)) {
    let i = 0;
    while (i < body.length) {
      if (switchable) {
        const chr = CHR_SET_SWITCH.exec(body.slice(i));
        if (chr) {
          lowerSet = chr[1] === '14';
          i += chr[0].length;
          continue;
        }
      }
      const unit = unitAt(body, i, ctx);
      const code = unit.codes[0];
      if (switchable && code !== undefined) {
        if (code === TO_LOWER_SET) lowerSet = true;
        else if (code === TO_UPPER_SET) lowerSet = false;
      }
      // Notation, whatever letters it is spelled with; or a half-typed escape
      // or a character the machine cannot store at all, which already fails to
      // build and is reported where it occurs. Neither is this report's
      // business, so step over it and carry on.
      if (unit.kind !== 'text' || code === undefined) {
        i += unit.length;
        continue;
      }
      const from = body[i]!;
      const to = ctx.probe.decode(code);
      if (to !== from && !(lowerSet && /[A-Za-z]/.test(from))) {
        findings.push({ from, to, line, column: i });
      }
      i += 1;
    }
  }

  return { count: findings.length, findings };
}
