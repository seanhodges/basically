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
 * Each finding carries its own position as well as the total. The status bar
 * needs only the count, but a position recovered later would mean walking the
 * source twice.
 */
import { CharsetError, type Dialect } from '../dialects/types';
import { probeFor, type CharsetProbe } from '../dialects/charsetProbes';
import { keywordSpellingsFor, spellingAt } from '../dialects/keywordSpellings';
import { foldsKeywordCase, letterCaseFor } from '../dialects/letterCase';
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
 * The walk goes a unit at a time through the machine's own charset parser,
 * which is what exempts notation structurally rather than by a list: **a unit
 * longer than one source character is notation** - every braced escape, every
 * raw byte, every backslash form - and the escapes are full of lower case that
 * is load-bearing. Short keyword spellings are consumed ahead of the parser for
 * the same reason: the Commodores' shifted-letter form *requires* a lower-case
 * prefix, and it is a spelling rather than text.
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
  const probe = probeFor(dialect.id);
  if (!probe) return EMPTY;
  const spellings = keywordSpellingsFor(dialect.id);
  const folds = foldsKeywordCase(dialect.id);
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
      const short = spellingAt(body, i, spellings, folds);
      if (short) {
        i += short.length;
        continue;
      }
      const unit = parseUnit(probe, body, i);
      if (!unit) {
        // A half-typed escape, or a character the machine cannot store at all.
        // The latter already fails to build and is reported where it occurs;
        // neither is this report's business, so step over it and carry on -
        // the same catch-and-continue the program vocabulary walks with.
        i += 1;
        continue;
      }
      const code = unit.codes[0];
      if (switchable && code !== undefined) {
        if (code === TO_LOWER_SET) lowerSet = true;
        else if (code === TO_UPPER_SET) lowerSet = false;
      }
      // Notation, whatever letters it is spelled with.
      if (unit.length > 1 || code === undefined || unit.codes.length !== 1) {
        i += unit.length;
        continue;
      }
      const from = body[i]!;
      const to = probe.decode(code);
      if (to !== from && !(lowerSet && /[A-Za-z]/.test(from))) {
        findings.push({ from, to, line, column: i });
      }
      i += 1;
    }
  }

  return { count: findings.length, findings };
}

/** One unit at `i`, or null where the machine cannot read what is there. */
function parseUnit(
  probe: CharsetProbe,
  text: string,
  i: number,
): { codes: number[]; length: number } | null {
  try {
    const unit = probe.parseUnit(text, i);
    return unit.length > 0 ? unit : null;
  } catch (e) {
    if (e instanceof CharsetError) return null;
    throw e;
  }
}
