// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { unwrapPmd85StoredFile } from './storedFile';
import {
  BASIC_FILE_TYPE,
  DATA_FILE_TYPE,
  HEADER_BLOCK_BYTES,
  buildPmdImage,
  type Pmd85TapeFile,
} from './tape';

const PAYLOAD = Uint8Array.from([0x01, 0x06, 0x00, 0x40, 0x00, 0xff]);

function tapeFile(type: number): Pmd85TapeFile {
  return {
    header: { number: 2, type, start: 0x7000, name: '' },
    bytes: PAYLOAD,
  };
}

describe('unwrapping a file the PMD 85 deck stored', () => {
  it('splits a saved array into its bytes and the tape header', () => {
    const { payload, container } = unwrapPmd85StoredFile(
      buildPmdImage(tapeFile(DATA_FILE_TYPE)),
    );
    expect(Array.from(payload)).toEqual(Array.from(PAYLOAD));
    expect(container).not.toBeNull();
    expect(container!.length).toBe(HEADER_BLOCK_BYTES);
    // The leader is the first thing a user would otherwise be shown.
    expect(container![0]).toBe(0xff);
    expect(container![HEADER_BLOCK_BYTES - 15]).toBe(2); // file number
  });

  it('splits a saved program the same way', () => {
    // The seam is about framing rather than about what the file holds, so a
    // `>` file unwraps as readily as a `D` one.
    const { payload, container } = unwrapPmd85StoredFile(
      buildPmdImage(tapeFile(BASIC_FILE_TYPE)),
    );
    expect(Array.from(payload)).toEqual(Array.from(PAYLOAD));
    expect(container!.length).toBe(HEADER_BLOCK_BYTES);
  });

  it('hands back bytes that are not one whole tape file', () => {
    // Another machine's leftovers, or a capture that stopped part way. Showing
    // them whole beats refusing to show them.
    const whole = buildPmdImage(tapeFile(DATA_FILE_TYPE));
    for (const [label, bytes] of [
      ['empty', new Uint8Array()],
      ['a lone byte', Uint8Array.from([0x41])],
      ['plain text', Uint8Array.from([0x48, 0x49, 0x0d, 0x0a])],
      ['a header with no body', whole.slice(0, HEADER_BLOCK_BYTES)],
      ['a body cut short', whole.slice(0, whole.length - 2)],
    ] as [string, Uint8Array][]) {
      const got = unwrapPmd85StoredFile(bytes);
      expect(Array.from(got.payload), label).toEqual(Array.from(bytes));
      expect(got.container, label).toBeNull();
    }
  });
});
