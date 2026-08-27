import { describe, it, expect } from 'vitest';
import { unwrapSpectrumStoredFile } from './storedFile';
import { tapFromPayloads } from './tapfile';
import { getDialect } from '../registry';

/**
 * A tape header payload of the type the deck stores: type byte, 10-byte name,
 * then the three parameter words. `length` is the data block's size, which is
 * what makes the header the wrapper rather than part of the file.
 */
function header(type: number, name: string, length: number): Uint8Array {
  const h = new Uint8Array(17).fill(0x20);
  h[0] = type;
  // ASCII letters share their codes with the Spectrum charset, so the name
  // needs no encoding here; bytes 11-16 are the header's parameter words.
  for (let i = 0; i < name.length && i < 10; i++) h[1 + i] = name.charCodeAt(i);
  h[11] = length & 0xff;
  h[12] = (length >> 8) & 0xff;
  return h;
}

describe('unwrapSpectrumStoredFile', () => {
  // The three header types the deck actually captures - a program SAVE passes
  // through to real tape and never reaches the store.
  const types: [string, number][] = [
    ['a number array', 1],
    ['a character array', 2],
    ['a code block', 3],
  ];

  for (const [label, type] of types) {
    it(`splits ${label} into its data and its header`, () => {
      const data = Uint8Array.from([1, 2, 3, 4, 5]);
      const head = header(type, 'scores', data.length);
      const { payload, container } = unwrapSpectrumStoredFile(
        tapFromPayloads(head, data),
      );
      expect(Array.from(payload)).toEqual([1, 2, 3, 4, 5]);
      expect(container).not.toBeNull();
      expect(Array.from(container!)).toEqual(Array.from(head));
      expect(container![0]).toBe(type);
    });
  }

  it('unwraps an empty data block to an empty payload', () => {
    const { payload, container } = unwrapSpectrumStoredFile(
      tapFromPayloads(header(1, 'empty', 0), new Uint8Array()),
    );
    expect(payload.length).toBe(0);
    expect(container).not.toBeNull();
  });

  // Bytes the deck did not write - a truncated image, a file some other
  // machine left in the store - are shown whole rather than refused.
  it('hands back bytes that are not a header/data pair unchanged', () => {
    for (const bytes of [
      Uint8Array.from([1, 2, 3]),
      new Uint8Array(),
      // A header block with nothing after it.
      tapFromPayloads(header(1, 'half', 4), new Uint8Array()).slice(0, 20),
    ]) {
      const { payload, container } = unwrapSpectrumStoredFile(bytes);
      expect(Array.from(payload)).toEqual(Array.from(bytes));
      expect(container).toBeNull();
    }
  });
});

describe('a dialect that declares no container', () => {
  it('is read as storing the payload itself', () => {
    // The BBC writes raw bytes to its store, so it declares nothing and the
    // projection falls back to the stored bytes.
    expect(getDialect('bbcmicro').unwrapStoredFile).toBeUndefined();
  });
});
