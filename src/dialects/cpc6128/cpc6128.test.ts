import { describe, expect, it } from 'vitest';
import { cpc6128 } from './index';
import { cpc464 } from '../cpc464';
import { cpc6128Keywords } from './keywords';

/**
 * The 6128 delegates its whole language layer to the 464 behind the BASIC
 * variant seam, so what is worth testing here is exactly the delta: the eleven
 * 1.1 additions work on this machine and not on the 464, and everything the two
 * share stays byte-identical.
 */

/** The BASIC 1.1 additions, as the CPC 6128 manual lists them. */
const BASIC_11_ONLY = [
  'CLEAR INPUT',
  'COPYCHR$',
  'CURSOR',
  'DEC$',
  'DERR',
  'FILL',
  'FRAME',
  'GRAPHICS PAPER',
  'GRAPHICS PEN',
  'MASK',
  'ON BREAK CONT',
] as const;

type Basic11Word = (typeof BASIC_11_ONLY)[number];

/**
 * One line per addition, in a form the tokenizer will accept. GRAPHICS is the
 * shared prefix token for PEN/PAPER, so both phrases exercise it.
 */
const USES_11: Record<Basic11Word, string> = {
  'CLEAR INPUT': '10 CLEAR INPUT',
  COPYCHR$: '10 A$=COPYCHR$(#0)',
  CURSOR: '10 CURSOR 1,1',
  DEC$: '10 PRINT DEC$(1,"##")',
  DERR: '10 PRINT DERR',
  FILL: '10 FILL 3',
  FRAME: '10 FRAME',
  'GRAPHICS PAPER': '10 GRAPHICS PAPER 1',
  'GRAPHICS PEN': '10 GRAPHICS PEN 2',
  MASK: '10 MASK 170',
  'ON BREAK CONT': '10 ON BREAK CONT',
};

/**
 * The additions spelled as a single word, which is what BASIC 1.0 can actually
 * detect as missing. The four phrases (CLEAR INPUT, GRAPHICS PEN/PAPER, ON
 * BREAK CONT) are built from tokens 1.0 already has, so they are 1.1-only in
 * meaning rather than in spelling.
 */
const GATED_ON_464: Basic11Word[] = [
  'COPYCHR$',
  'CURSOR',
  'DEC$',
  'DERR',
  'FILL',
  'FRAME',
  'MASK',
];

/** Source using only keywords both machines have. */
const SHARED = [
  '10 MODE 1',
  '20 INK 1,24',
  '30 FOR I=1 TO 10',
  '40 PRINT "HELLO";I',
  '50 NEXT I',
  '60 PLOT 100,100:DRAW 500,300',
  '70 IF I>1 THEN GOTO 30',
  '80 END',
  '',
].join('\n');

describe('cpc6128 dialect', () => {
  it('offers the eleven BASIC 1.1 keywords the 464 does not', () => {
    const words = new Set(cpc6128Keywords.map((k) => k.word));
    for (const word of BASIC_11_ONLY) expect(words.has(word)).toBe(true);

    const on464 = new Set(cpc464.keywords.map((k) => k.word));
    expect(BASIC_11_ONLY.filter((w) => on464.has(w))).toEqual([]);
    // Nothing is lost going 1.0 -> 1.1: the 6128's table is a strict superset,
    // and it adds nothing beyond the manual's eleven. GRAPHICS appears too as
    // the bare token entry PEN/PAPER are spelled with.
    for (const k of cpc464.keywords) expect(words.has(k.word)).toBe(true);
    const added = cpc6128Keywords
      .map((k) => k.word)
      .filter((w) => !on464.has(w))
      .sort();
    expect(added).toEqual([...BASIC_11_ONLY, 'GRAPHICS'].sort());
  });

  it('tokenizes the eleven BASIC 1.1-only keywords', () => {
    for (const word of BASIC_11_ONLY) {
      const line = USES_11[word];
      const result = cpc6128.tokenize(`${line}\n`);
      expect(result.errors, line).toEqual([]);
      expect(result.programBytes.length, line).toBeGreaterThan(2);
    }
  });

  it('rejects those keywords on the cpc464 with a clear error', () => {
    for (const word of GATED_ON_464) {
      const line = USES_11[word];
      const errors = cpc464.lint(`${line}\n`);
      expect(errors.length, line).toBeGreaterThan(0);
      expect(errors[0]!.message, line).toContain(word);
      expect(errors[0]!.message, line).toContain('1.1');
      expect(errors[0]!.message, line).toContain('CPC 464');
      expect(errors[0]!.line, line).toBe(1);
      // The same line is clean on the 6128.
      expect(cpc6128.lint(`${line}\n`), line).toEqual([]);
    }
  });

  it('round-trips programs identically to cpc464 for shared BASIC 1.0 source', () => {
    const on6128 = cpc6128.tokenize(SHARED);
    const on464 = cpc464.tokenize(SHARED);
    expect(on6128.errors).toEqual([]);
    expect(on464.errors).toEqual([]);
    expect(Array.from(on6128.programBytes)).toEqual(
      Array.from(on464.programBytes),
    );
    expect(cpc6128.detokenize(on6128.image)).toBe(SHARED);
    expect(cpc6128.detokenize(on6128.image)).toBe(
      cpc464.detokenize(on464.image),
    );
  });

  it('round-trips a BASIC 1.1 program back to its source', () => {
    const source = [
      '10 GRAPHICS PEN 2',
      '20 MASK 170',
      '30 FILL 3',
      '40 FRAME',
      '50 PRINT DEC$(1,"##")',
      '',
    ].join('\n');
    const { image, errors } = cpc6128.tokenize(source);
    expect(errors).toEqual([]);
    expect(cpc6128.detokenize(image)).toBe(source);
  });

  it('exports the same tape and disc containers as the 464', () => {
    expect(cpc6128.buildTargets.map((t) => t.fileExtension)).toEqual(
      cpc464.buildTargets.map((t) => t.fileExtension),
    );
    // Target ids are per-dialect so the two machines' exports stay distinct.
    for (const t of cpc6128.buildTargets) expect(t.id).toMatch(/^cpc6128-/);
  });
});
