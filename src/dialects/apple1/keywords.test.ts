import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPLE1_DIRECT_ONLY,
  APPLE1_NONFUNCTIONAL,
  apple1Keywords,
  apple1Operators,
  T,
} from './keywords';
import { BASIC_BASE, MONITOR_BYTES } from './addresses';

/**
 * Check the keyword table against the interpreter image the machine ships with,
 * rather than against a spelling list copied from a manual.
 *
 * The Apple I has no reserved-word table to read. What it has is a syntax table
 * at `$EC53`-`$EDFF` and a decoder in `LIST` that finds a token's spelling by
 * counting keyword boundaries backwards through it: token N is the Nth boundary
 * below `$EDFF`, or below `$ECFF` for N >= `$51`. {@link spellingOf} is that
 * decoder, and every token this dialect claims has to come back out of the
 * image spelled the way the table says.
 *
 * A keyword's characters are stored in the table **reversed**, each with `$60`
 * added, and the last character of the spelling - the one at the lowest address
 * - additionally carries bit 6 to mark the boundary. That is why the decoder
 * walks downwards and stops on a byte >= `$C0`.
 */

const ROM = join(__dirname, '../../../public/roms/apple1/apple1.rom');
const image = new Uint8Array(readFileSync(ROM)).subarray(MONITOR_BYTES);

const at = (address: number): number => image[address - BASIC_BASE]!;

/** What `LIST` prints for a token, read out of the shipped image. */
function spellingOf(token: number): string {
  let base = 0xed00;
  let remaining = token;
  if (token >= 0x51) {
    base = 0xec00;
    remaining = token - 0x50;
  }
  let y = 0;
  // Count keyword boundaries downwards; a boundary is a byte >= $C0, or any
  // byte below $80 (a grammar control byte between two rules).
  while (remaining > 0) {
    let a = at(base + y);
    for (;;) {
      const previous = a;
      y = (y - 1) & 0xff;
      a = at(base + y);
      if (a & 0x80 && (previous >= 0xc0 || !(previous & 0x80))) break;
    }
    remaining--;
  }
  let text = '';
  for (;;) {
    const b = at(base + y);
    if (!(b & 0x80)) break;
    text += String.fromCharCode(((b & 0x3f) + 0xa0) & 0x7f);
    y = (y - 1) & 0xff;
    if (b >= 0xc0) break;
  }
  return text;
}

describe('apple1 keywords', () => {
  it('spells every keyword the way the shipped interpreter does', () => {
    const spellings = new Map<number, string>();
    for (const k of apple1Keywords) spellings.set(k.token, k.word);
    for (const [token, word] of spellings) {
      // LEN is the one keyword whose token carries its opening parenthesis, so
      // the image spells it `LEN(` while the editor's word is `LEN` - the
      // parenthesis is punctuation the completion supplies.
      const expected = word === 'LEN' ? 'LEN(' : word;
      expect(`$${token.toString(16)} -> ${spellingOf(token)}`).toBe(
        `$${token.toString(16)} -> ${expected}`,
      );
    }
  });

  it('is LEN alone that carries its parenthesis in the token', () => {
    const carriers = apple1Keywords.filter((k) =>
      spellingOf(k.token).endsWith('('),
    );
    expect(carriers.map((k) => k.word)).toEqual(['LEN']);
  });

  it('spells the context-dependent tokens the same way as their keyword', () => {
    // The tokenizer picks between these by grammar rule; the image has to agree
    // that they are all the same word, or a listing would decode wrongly.
    expect([T.PRINT_STR, T.PRINT_NUM, T.PRINT].map(spellingOf)).toEqual([
      'PRINT',
      'PRINT',
      'PRINT',
    ]);
    expect([T.INPUT_STR, T.INPUT_PROMPT, T.INPUT_NUM].map(spellingOf)).toEqual([
      'INPUT',
      'INPUT',
      'INPUT',
    ]);
    expect([T.DIM_STR, T.DIM_NUM].map(spellingOf)).toEqual(['DIM', 'DIM']);
    expect([T.THEN_LINE, T.THEN_STMT].map(spellingOf)).toEqual([
      'THEN',
      'THEN',
    ]);
    const commas = [
      T.SUBSTR_COMMA,
      T.INPUT_COMMA_STR,
      T.INPUT_COMMA_NUM,
      T.DIM_COMMA_STR,
      T.DIM_COMMA_NUM,
      T.PRINT_COMMA_STR,
      T.PRINT_COMMA_NUM,
      T.NEXT_COMMA,
      T.POKE_COMMA,
    ];
    expect(commas.map(spellingOf)).toEqual(commas.map(() => ','));
    const parens = [
      T.DIM_STR_LPAREN,
      T.SUBSTR_LPAREN,
      T.ARRAY_LPAREN,
      T.DIM_NUM_LPAREN,
      T.LPAREN,
      T.FN_LPAREN,
      T.STR_DEST_LPAREN,
    ];
    expect(parens.map(spellingOf)).toEqual(parens.map(() => '('));
    expect(spellingOf(T.RPAREN)).toBe(')');
  });

  it('spells the memory commands with = , not the Apple II colon', () => {
    // The single most likely thing to be copied wrong from the machine the
    // world remembers: `HIMEM:` there, `HIMEM=` here.
    expect(spellingOf(T.HIMEM_SET)).toBe('HIMEM=');
    expect(spellingOf(T.LOMEM_SET)).toBe('LOMEM=');
    expect(apple1Keywords.map((k) => k.word)).toContain('HIMEM=');
    expect(apple1Keywords.map((k) => k.word)).not.toContain('HIMEM:');
  });

  it('cancels AUTO with OFF, because this ROM has no MAN', () => {
    expect(spellingOf(T.OFF)).toBe('OFF');
    expect(encoded('MAN')).toBe(-1);
    expect(apple1Keywords.map((k) => k.word)).not.toContain('MAN');
  });

  it('offers none of the Apple II words the image does not contain', () => {
    // Each of these is in Apple II Integer BASIC and in nothing here; searching
    // the image for the syntax table's own encoding is what proves the absence.
    for (const word of ['ASC', 'SCRN', 'VLIN', 'VTAB', 'GR', 'TEXT', 'NEW']) {
      expect(`${word}:${encoded(word)}`).toBe(`${word}:-1`);
      expect(apple1Keywords.map((k) => k.word)).not.toContain(word);
    }
  });

  it('keeps the words the machine cannot execute out of the keyword table', () => {
    const words = new Set(apple1Keywords.map((k) => k.word));
    for (const word of Object.keys(APPLE1_NONFUNCTIONAL)) {
      // They are in the image - which is why they are worth a message - but
      // completing a word that hangs the machine would be worse than silence.
      expect(`${word}:${encoded(word) >= 0}`).toBe(`${word}:true`);
      expect(words.has(word)).toBe(false);
    }
  });

  it('lists every direct-mode command as a keyword', () => {
    const words = new Set(apple1Keywords.map((k) => k.word));
    for (const word of APPLE1_DIRECT_ONLY) expect(words.has(word)).toBe(true);
  });

  it('has one entry per spelling and a signature on each', () => {
    const words = apple1Keywords.map((k) => k.word);
    expect(new Set(words).size).toBe(words.length);
    for (const k of apple1Keywords) {
      expect(k.word).toBe(k.word.toUpperCase());
      expect(k.signature).toBeTruthy();
      expect(k.doc).toBeTruthy();
    }
  });

  it('orders the symbolic operators longest first', () => {
    const lengths = apple1Operators.map((o) => o.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
    expect(apple1Operators).toContain('#');
  });
});

/** Where the syntax table holds `word`, or -1. Boundary-flagged or not. */
function encoded(word: string): number {
  for (const flagged of [true, false]) {
    const bytes = [
      (word.charCodeAt(word.length - 1) + (flagged ? 0xa0 : 0x60)) & 0xff,
      ...[...word]
        .slice(0, -1)
        .reverse()
        .map((c) => (c.charCodeAt(0) + 0x60) & 0xff),
    ];
    outer: for (let i = 0; i + bytes.length <= image.length; i++) {
      for (let j = 0; j < bytes.length; j++)
        if (image[i + j] !== bytes[j]) continue outer;
      return i;
    }
  }
  return -1;
}
