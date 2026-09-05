// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What the editors read at a position, checked against the real tokenizers.
 *
 * Three machines rather than the whole registry: one crunched (the ROM splits
 * identifier runs), one Acorn (case-sensitive names, `PROC`/`FN` calls) and one
 * Sinclair. Between them they cover the recognition rules that differ; the
 * per-machine operator matrix is `dialectOperators.test.ts`' job and is not
 * repeated here.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { getDialect } from '../dialects/registry';
import { asmLanguage } from '../asm/language';
import { z80Engine } from '../asm/z80';
import { m6502Engine } from '../asm/m6502';
import type { AsmEngine } from '../asm/types';
import { tokenAt } from './tokenAt';

/** Everything a BASIC reference lookup accepts. */
const BASIC_KINDS = ['keyword', 'functionName', 'operator'];

function basicState(dialectId: string, doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [getDialect(dialectId).languageSupport()],
  });
}

function asmState(engine: AsmEngine, doc: string): EditorState {
  return EditorState.create({ doc, extensions: [asmLanguage(engine)] });
}

/** The token text at the first offset of `needle`, or null. */
function at(
  state: EditorState,
  needle: string,
  kinds = BASIC_KINDS,
  occurrence = 0,
): string | null {
  const doc = state.doc.toString();
  let index = -1;
  for (let i = 0; i <= occurrence; i++) index = doc.indexOf(needle, index + 1);
  if (index === -1) throw new Error(`${needle} not in ${JSON.stringify(doc)}`);
  return tokenAt(state, index, kinds)?.text ?? null;
}

describe('reading a BASIC token', () => {
  it('finds a keyword at every offset within it, and at both edges', () => {
    const state = basicState('zx81', '10 PRINT "HI"');
    const start = state.doc.toString().indexOf('PRINT');
    // Both edges count, so clicking either end of a name still picks it - the
    // same rule the variable lookup follows.
    for (let pos = start; pos <= start + 'PRINT'.length; pos++) {
      expect(tokenAt(state, pos, BASIC_KINDS)?.text, `offset ${pos}`).toBe(
        'PRINT',
      );
    }
  });

  it('finds a function name', () => {
    expect(at(basicState('zx81', '10 LET A=SIN 1'), 'SIN')).toBe('SIN');
  });

  it('finds a declared multi-character operator whole', () => {
    // `<=` is one token, not `<` then `=`; the dialect declares the spelling and
    // the highlighter matches the alternation ahead of the character class.
    expect(at(basicState('bbcmicro', '10 IF A<=B THEN END'), '<=')).toBe('<=');
  });

  it.each([
    ['a line number', '10 PRINT "HI"', '10'],
    ['a number', '10 LET A=42', '42'],
    ['a string body', '10 PRINT "SIN"', 'SIN'],
    ['a variable', '10 LET SCORE=1', 'SCORE'],
  ])('offers nothing on %s', (_what, doc, needle) => {
    expect(at(basicState('zx81', doc), needle)).toBeNull();
  });

  it('offers nothing in whitespace between tokens', () => {
    // Two spaces, so the position asked about touches neither token. One space
    // would be the keyword's own right edge, which does answer.
    const state = basicState('zx81', '10 PRINT  "HI"');
    expect(
      tokenAt(state, state.doc.toString().indexOf('  ') + 1, BASIC_KINDS),
    ).toBeNull();
  });

  it('offers nothing inside a comment body', () => {
    // The word is a real keyword everywhere else on the line; inside REM the
    // tokenizer has already called the rest of the line a comment.
    expect(at(basicState('zx81', '10 REM PRINT ME'), 'PRINT')).toBeNull();
  });

  it('offers nothing on an opaque binary line', () => {
    // A #BIN line carries no line number - the directive opens the line - and
    // its payload is base64, which can spell a keyword by coincidence.
    const state = basicState('zxspectrum', '#BIN UFJJTlRBQQ==\n10 LET A=1');
    expect(at(state, 'UFJJ')).toBeNull();
  });

  it('splits a crunched run the way the ROM does', () => {
    // `POKEA=1` is POKE + A on a machine that crunches: the keyword half answers
    // and the variable half does not.
    const state = basicState('commodore64', '10 POKEA=1');
    expect(at(state, 'POKE')).toBe('POKE');
    expect(at(state, 'A=')).toBeNull();
  });

  it('reads past the end of the lazily-parsed tree', () => {
    // The tree is built lazily and stops a few kilobytes in, so a position
    // beyond that resolves to nothing until the parse is forced. This is the
    // guard for that: the failure it prevents is a menu row that is sometimes
    // missing, which nobody reports as a bug.
    //
    // 500 lines is chosen for the mechanism, not for the budget: it is already
    // more than twice what the lazy tree covers, while the forced parse takes a
    // small fraction of the allowance. Sizing it to exhaust the allowance
    // instead would assert how fast the machine running the test is.
    const lines = Array.from(
      { length: 500 },
      (_, i) => `${(i + 1) * 10} LET A=${i}`,
    );
    lines.push('5010 PLOT 1,1');
    const state = basicState('zx81', lines.join('\n'));
    const pos = state.doc.toString().indexOf('PLOT');
    expect(syntaxTree(state).length).toBeLessThan(pos);
    expect(tokenAt(state, pos, BASIC_KINDS)?.text).toBe('PLOT');
  });
});

describe('reading an assembly token', () => {
  it.each([
    ['z80', z80Engine, '  LD A,5', 'LD'],
    ['6502', m6502Engine, '  LDA #5', 'LDA'],
  ])('%s finds an instruction', (_cpu, engine, doc, needle) => {
    expect(at(asmState(engine, doc), needle, ['keyword'])).toBe(needle);
  });

  it.each([
    ['z80', z80Engine],
    ['6502', m6502Engine],
  ])('%s finds an assembler directive', (_cpu, engine) => {
    // Directives share the mnemonic set, and the reference pages carry rows for
    // them, so they answer exactly as an instruction does.
    expect(at(asmState(engine, '  ORG $8000'), 'ORG', ['keyword'])).toBe('ORG');
  });

  it('offers nothing on a register or a label reference', () => {
    const state = asmState(z80Engine, 'loop:\n  LD A,5\n  JP loop');
    expect(at(state, 'A,', ['keyword'])).toBeNull();
    expect(at(state, 'loop', ['keyword'], 1)).toBeNull();
  });
});
