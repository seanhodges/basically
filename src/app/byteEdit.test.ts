// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  applyCharacter,
  applyHexDigit,
  fillRange,
  isHexDigit,
  listingByteRefusal,
  loadBytes,
  maxBlockLength,
  parseByteValue,
  setLength,
  truncateLast,
  type ByteEditOutcome,
  type ByteTarget,
} from './byteEdit';
import { getDialect } from '../dialects/registry';
import { CharsetError, type CharsetMapping } from '../dialects/types';

function target(bytes: number[], address = 0x9000): ByteTarget {
  return { bytes: Uint8Array.from(bytes), address };
}

function ok(outcome: ByteEditOutcome) {
  if (!outcome.ok) throw new Error(`refused: ${outcome.message}`);
  return outcome.edit;
}

describe('parseByteValue', () => {
  it('reads the address spellings the IDE uses elsewhere', () => {
    expect(parseByteValue('$ff')).toBe(255);
    expect(parseByteValue('0x0A')).toBe(10);
    expect(parseByteValue('&40')).toBe(64);
    expect(parseByteValue(' 7 ')).toBe(7);
  });

  it('rejects anything that is not one byte', () => {
    expect(parseByteValue('256')).toBeNull();
    expect(parseByteValue('$100')).toBeNull();
    expect(parseByteValue('-1')).toBeNull();
    expect(parseByteValue('')).toBeNull();
  });
});

describe('applyHexDigit', () => {
  it('writes the high nibble and stays on the byte', () => {
    const edit = ok(
      applyHexDigit(target([0x12]), { index: 0, nibble: 'high' }, 'a'),
    );
    expect([...edit.bytes]).toEqual([0xa2]);
    expect(edit.caret).toEqual({ index: 0, nibble: 'low' });
  });

  it('writes the low nibble and advances to the next byte', () => {
    const edit = ok(
      applyHexDigit(target([0xa2, 0x00]), { index: 0, nibble: 'low' }, 'f'),
    );
    expect([...edit.bytes]).toEqual([0xaf, 0x00]);
    expect(edit.caret).toEqual({ index: 1, nibble: 'high' });
  });

  it('sequences a whole byte from two digits', () => {
    const first = ok(
      applyHexDigit(target([0, 0]), { index: 1, nibble: 'high' }, '3'),
    );
    const second = ok(
      applyHexDigit({ bytes: first.bytes, address: 0x9000 }, first.caret, 'c'),
    );
    expect([...second.bytes]).toEqual([0x00, 0x3c]);
    expect(second.caret).toEqual({ index: 2, nibble: 'high' });
  });

  it('grows the block when a value is entered at the append position', () => {
    const edit = ok(
      applyHexDigit(target([0x11]), { index: 1, nibble: 'high' }, '9'),
    );
    expect([...edit.bytes]).toEqual([0x11, 0x90]);
    expect(edit.caret).toEqual({ index: 1, nibble: 'low' });
  });

  it('starts a block from nothing', () => {
    const edit = ok(
      applyHexDigit(target([]), { index: 0, nibble: 'high' }, '4'),
    );
    expect([...edit.bytes]).toEqual([0x40]);
  });

  it('never moves the bytes around the one it writes', () => {
    const edit = ok(
      applyHexDigit(target([1, 2, 3, 4, 5]), { index: 2, nibble: 'high' }, 'e'),
    );
    expect([...edit.bytes]).toEqual([1, 2, 0xe3, 4, 5]);
  });

  it('refuses a key that is not a hex digit', () => {
    expect(isHexDigit('g')).toBe(false);
    const outcome = applyHexDigit(
      target([0]),
      { index: 0, nibble: 'high' },
      'g',
    );
    expect(outcome.ok).toBe(false);
  });

  it('refuses to grow past the top of memory', () => {
    const outcome = applyHexDigit(
      target([1], 0xffff),
      { index: 1, nibble: 'high' },
      '1',
    );
    expect(outcome.ok).toBe(false);
    expect(maxBlockLength(0xffff)).toBe(1);
  });
});

describe('applyCharacter', () => {
  // The ZX81's charset: letters sit at machine-specific codes, and most of
  // unicode has no code at all.
  const charset = getDialect('zx81').charset;

  it('round-trips a character through the machine charset', () => {
    const edit = ok(applyCharacter(target([0, 0]), 0, 'A', charset));
    expect(edit.bytes[0]).toBe(charset.toMachine('A')[0]);
    expect(charset.glyph(edit.bytes[0]!)).toBe('A');
    expect(edit.caret).toEqual({ index: 1, nibble: 'high' });
  });

  it('grows the block at the append position', () => {
    const edit = ok(applyCharacter(target([0x26]), 1, 'B', charset));
    expect(edit.bytes.length).toBe(2);
  });

  it('refuses a character the machine cannot represent', () => {
    const outcome = applyCharacter(target([0]), 0, '€', charset);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain('€');
  });

  it('refuses text that is not a single machine character', () => {
    const outcome = applyCharacter(target([0]), 0, 'AB', charset);
    expect(outcome.ok).toBe(false);
  });

  it('rethrows anything that is not a CharsetError', () => {
    const broken: CharsetMapping = {
      toMachine: () => {
        throw new TypeError('not a charset problem');
      },
      toUnicode: () => '',
      glyph: () => '?',
    };
    expect(() => applyCharacter(target([0]), 0, 'A', broken)).toThrow(
      TypeError,
    );
    const refusing: CharsetMapping = {
      toMachine: () => {
        throw new CharsetError('no code', 0);
      },
      toUnicode: () => '',
      glyph: () => '?',
    };
    expect(applyCharacter(target([0]), 0, 'A', refusing).ok).toBe(false);
  });
});

describe('truncateLast', () => {
  it('drops the last byte and leaves the rest where they were', () => {
    const edit = ok(truncateLast(target([1, 2, 3])));
    expect([...edit.bytes]).toEqual([1, 2]);
    expect(edit.caret).toEqual({ index: 2, nibble: 'high' });
  });

  it('truncates a one-byte block to nothing', () => {
    const edit = ok(truncateLast(target([9])));
    expect(edit.bytes.length).toBe(0);
    expect(edit.caret).toEqual({ index: 0, nibble: 'high' });
  });

  it('refuses on an empty block', () => {
    expect(truncateLast(target([])).ok).toBe(false);
  });
});

describe('setLength', () => {
  it('pads with zero when it grows', () => {
    const edit = ok(setLength(target([1, 2]), 5));
    expect([...edit.bytes]).toEqual([1, 2, 0, 0, 0]);
  });

  it('truncates when it shrinks', () => {
    expect([...ok(setLength(target([1, 2, 3, 4]), 2)).bytes]).toEqual([1, 2]);
  });

  it('allows a length of zero', () => {
    expect(ok(setLength(target([1, 2]), 0)).bytes.length).toBe(0);
  });

  it('clamps at the 64K ceiling', () => {
    const edit = ok(setLength(target([1], 0xff00), 0x1000));
    expect(edit.bytes.length).toBe(0x100);
    expect(maxBlockLength(0xff00)).toBe(0x100);
  });

  it('clamps a negative length to nothing', () => {
    expect(ok(setLength(target([1, 2]), -5)).bytes.length).toBe(0);
  });

  it('refuses a length that is not a whole number', () => {
    expect(setLength(target([1]), 1.5).ok).toBe(false);
  });

  it('restores the bytes a shrink discarded when it is reversed', () => {
    // Undo is the editor's history, but the model has to be able to describe
    // the state it returns to: the discarded bytes come back by value.
    const start = target([1, 2, 3, 4]);
    const shrunk = ok(setLength(start, 2));
    const regrown = ok(
      setLength({ bytes: shrunk.bytes, address: start.address }, 4),
    );
    expect([...regrown.bytes]).toEqual([1, 2, 0, 0]);
    // Which is why the surface undoes through the document rather than by
    // re-running setLength: only the history holds the values that were there.
    expect([...start.bytes]).toEqual([1, 2, 3, 4]);
  });
});

describe('fillRange', () => {
  it('fills the addresses named, and no others', () => {
    const edit = ok(
      fillRange(target([1, 2, 3, 4], 0x9000), 0x9001, 0x9002, 0xff),
    );
    expect([...edit.bytes]).toEqual([1, 0xff, 0xff, 4]);
    expect(edit.caret).toEqual({ index: 1, nibble: 'high' });
  });

  it('clamps a range that overhangs the block', () => {
    const edit = ok(fillRange(target([1, 2], 0x9000), 0x8000, 0xa000, 7));
    expect([...edit.bytes]).toEqual([7, 7]);
  });

  it('never changes the block length', () => {
    const edit = ok(fillRange(target([1, 2, 3], 0x9000), 0x9000, 0x9fff, 0));
    expect(edit.bytes.length).toBe(3);
  });

  it('refuses a range outside the block, a bad value, or an empty block', () => {
    expect(fillRange(target([1, 2], 0x9000), 0xa000, 0xa010, 0).ok).toBe(false);
    expect(fillRange(target([1, 2], 0x9000), 0x9001, 0x9000, 0).ok).toBe(false);
    expect(fillRange(target([1, 2], 0x9000), 0x9000, 0x9001, 300).ok).toBe(
      false,
    );
    expect(fillRange(target([], 0x9000), 0x9000, 0x9001, 0).ok).toBe(false);
  });
});

describe('loadBytes', () => {
  it('replaces the block contents and parks the caret at the start', () => {
    const edit = ok(loadBytes(target([1, 2, 3]), Uint8Array.from([9, 8])));
    expect([...edit.bytes]).toEqual([9, 8]);
    expect(edit.caret).toEqual({ index: 0, nibble: 'high' });
  });

  it('refuses a file that will not fit above the block address', () => {
    const outcome = loadBytes(target([0], 0xfff0), new Uint8Array(0x20));
    expect(outcome.ok).toBe(false);
  });
});

describe('listingByteRefusal', () => {
  // The two Sinclair machines differ in exactly this: a ZX81 record carries its
  // own length, a ZX80 record ends at the terminator byte.
  const zx80 = getDialect('zx80').memoryBlocks!.listing!;
  const zx81 = getDialect('zx81').memoryBlocks!.listing!;

  it('refuses a byte the ZX80 listing cannot carry', () => {
    const message = listingByteRefusal(
      Uint8Array.from([0xc9, zx80.terminator]),
      zx80,
    );
    expect(message).toContain('REM');
    expect(message).toContain('$76');
  });

  it('allows the same byte where the record carries a length', () => {
    expect(
      listingByteRefusal(Uint8Array.from([0xc9, zx81.terminator]), zx81),
    ).toBeNull();
  });

  it('allows bytes with no terminator in them, and every fixed-address block', () => {
    expect(listingByteRefusal(Uint8Array.from([0xc9]), zx80)).toBeNull();
    expect(
      listingByteRefusal(Uint8Array.from([zx80.terminator]), null),
    ).toBeNull();
    expect(
      listingByteRefusal(Uint8Array.from([zx80.terminator]), undefined),
    ).toBeNull();
  });
});
