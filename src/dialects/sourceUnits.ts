// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Telling one source character the machine stores from the notation that only
 * looks like characters.
 *
 * A BASIC line as this IDE holds it is not a string of machine characters. It
 * carries escapes (`{white}`), raw bytes (`{0x41}`, `\{41}`) and short keyword
 * spellings (`p.`, `pS`), each of them several source characters standing for
 * one machine code - and each of them full of letters that are notation rather
 * than text. Anything reading a line *as the machine will store it* has to make
 * that distinction, and there are two such readers: the report of what the
 * machine will convert ({@link ../app/convertedCharacters}) and the strict
 * editor's case forcing ({@link ../editor/machineCase}).
 *
 * They walk the line differently - one carries the Commodore character-set
 * state across the whole program, the other rewrites what it is handed - so
 * what is shared is the classification of a single position, not a loop. The
 * rule itself is structural rather than a list: **a unit longer than one source
 * character is notation**, whatever letters it is spelled with.
 */
import { CharsetError, type Dialect } from './types';
import { probeFor, type CharsetProbe } from './charsetProbes';
import {
  keywordSpellingsFor,
  spellingAt,
  type KeywordSpellings,
} from './keywordSpellings';
import { foldsKeywordCase } from './letterCase';

/** What one position in a line turns out to be. */
export type SourceUnitKind =
  /** One source character the machine stores as one code. */
  | 'text'
  /** Several source characters standing for something: an escape, a raw byte,
      a short keyword spelling. */
  | 'notation'
  /** The machine cannot read what is there - a half-typed escape, or a
      character its set has not got. */
  | 'unreadable';

export interface SourceUnit {
  kind: SourceUnitKind;
  /** How many source characters it spans (at least 1). */
  length: number;
  /** The codes it produces; empty when the machine cannot read it. */
  codes: number[];
}

/** Everything reading a line a unit at a time needs about the machine. */
export interface SourceUnitContext {
  probe: CharsetProbe;
  spellings: KeywordSpellings;
  /** Whether a short spelling is recognised in lower case here. */
  folds: boolean;
}

/** The per-machine context, or null for a machine with no charset probe. */
export function sourceUnitContext(dialect: Dialect): SourceUnitContext | null {
  const probe = probeFor(dialect.id);
  if (!probe) return null;
  return {
    probe,
    spellings: keywordSpellingsFor(dialect.id),
    folds: foldsKeywordCase(dialect.id),
  };
}

/**
 * What sits at `i` in `body`.
 *
 * Short keyword spellings are consumed ahead of the charset parser rather than
 * after it: the Commodores' shifted-letter form *requires* a lower-case prefix,
 * and it is a spelling rather than text, so a parser that saw the letter first
 * would call it a character the machine converts.
 *
 * Never throws and never returns a zero length, so a caller's walk always
 * advances - the same catch-and-continue posture the program vocabulary walks
 * with.
 */
export function unitAt(
  body: string,
  i: number,
  ctx: SourceUnitContext,
): SourceUnit {
  const short = spellingAt(body, i, ctx.spellings, ctx.folds);
  if (short) return { kind: 'notation', length: short.length, codes: [] };

  let parsed: { codes: number[]; length: number } | null = null;
  try {
    const unit = ctx.probe.parseUnit(body, i);
    if (unit.length > 0) parsed = unit;
  } catch (e) {
    if (!(e instanceof CharsetError)) throw e;
  }
  if (!parsed) return { kind: 'unreadable', length: 1, codes: [] };

  const single = parsed.length === 1 && parsed.codes.length === 1;
  return {
    kind: single ? 'text' : 'notation',
    length: parsed.length,
    codes: parsed.codes,
  };
}
