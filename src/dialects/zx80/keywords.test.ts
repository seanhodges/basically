import { describe, expect, it } from 'vitest';
import {
  zx80Keywords,
  zx80IntegralFunctions,
  zx80EditorKeywords,
} from './keywords';

/**
 * The ZX80's "integral functions" have no one-byte token — on real hardware they
 * are typed letter by letter and the ROM matches them by name. They must be
 * visible to the editor (highlighting + autocomplete) without ever being
 * tokenized, so the tokenizer keeps storing them as their literal characters.
 */
describe('ZX80 integral functions', () => {
  const NAMES = ['RND', 'PEEK', 'USR', 'ABS', 'CODE', 'CHR$', 'STR$', 'TL$'];

  it('exposes exactly the eight integral functions, token-less and kind function', () => {
    expect(zx80IntegralFunctions.map((k) => k.word).sort()).toEqual(
      [...NAMES].sort(),
    );
    for (const f of zx80IntegralFunctions) {
      expect(f.kind, f.word).toBe('function');
      expect('token' in f, f.word).toBe(false);
    }
  });

  it('keeps integral functions out of the tokenized keyword table', () => {
    for (const name of NAMES) {
      expect(
        zx80Keywords.find((k) => k.word === name),
        name,
      ).toBeUndefined();
    }
  });

  it('merges tokenized keywords and integral functions for the editor', () => {
    for (const name of NAMES) {
      expect(
        zx80EditorKeywords.find((k) => k.word === name),
        name,
      ).toBeDefined();
    }
    // The tokenized commands/operators are still present.
    expect(zx80EditorKeywords.find((k) => k.word === 'PRINT')).toBeDefined();
    expect(zx80EditorKeywords).toHaveLength(
      zx80Keywords.length + zx80IntegralFunctions.length,
    );
  });
});
