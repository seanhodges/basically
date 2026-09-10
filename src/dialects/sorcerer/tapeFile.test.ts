// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  TAPE_BLOCK_BYTES,
  TAPE_FILE_TYPE,
  TAPE_HEADER_BYTES,
  TAPE_LEAD_BYTES,
  TAPE_LEAD_MARK,
  TAPE_NAME_BYTES,
  TapeRecordError,
  buildTapeFile,
  parseTapeFile,
  parseTapeRecord,
  tapeName,
} from './tapeFile';
import { PROGRAM_BASE } from './addresses';

const OPTS = {
  programName: 'HELLO',
  loadAddress: PROGRAM_BASE,
  execAddress: 0x0000,
};

const payload = (n: number): Uint8Array =>
  Uint8Array.from({ length: n }, (_, i) => (i * 7 + 1) & 0xff);

/** The Monitor's running checksum over a run of bytes. */
const checksum = (bytes: ArrayLike<number>): number => {
  let c = 0;
  for (let i = 0; i < bytes.length; i++) c = ~(bytes[i]! - c) & 0xff;
  return c;
};

const HEADER_AT = TAPE_LEAD_BYTES + 1;

describe('sorcerer tape file', () => {
  it('builds the lead, the 16-byte header and its checksum', () => {
    const record = buildTapeFile(payload(3), OPTS);
    expect([...record.slice(0, TAPE_LEAD_BYTES)]).toEqual(
      Array(TAPE_LEAD_BYTES).fill(0x00),
    );
    expect(record[TAPE_LEAD_BYTES]).toBe(TAPE_LEAD_MARK);

    const header = record.slice(HEADER_AT, HEADER_AT + TAPE_HEADER_BYTES);
    expect([...header]).toEqual([
      ...[...'HELLO'].map((c) => c.charCodeAt(0)),
      TAPE_FILE_TYPE,
      0x00,
      0x03,
      0x00,
      PROGRAM_BASE & 0xff,
      PROGRAM_BASE >> 8,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    expect(record[HEADER_AT + TAPE_HEADER_BYTES]).toBe(checksum(header));
  });

  it('opens the data with a second lead', () => {
    const record = buildTapeFile(payload(3), OPTS);
    const at = HEADER_AT + TAPE_HEADER_BYTES + 1;
    expect([...record.slice(at, at + TAPE_LEAD_BYTES)]).toEqual(
      Array(TAPE_LEAD_BYTES).fill(0x00),
    );
    expect(record[at + TAPE_LEAD_BYTES]).toBe(TAPE_LEAD_MARK);
  });

  it('splits the payload into 256-byte blocks, each checksummed', () => {
    const data = payload(TAPE_BLOCK_BYTES + 5);
    const record = buildTapeFile(data, OPTS);
    const dataAt = HEADER_AT + TAPE_HEADER_BYTES + 1 + TAPE_LEAD_BYTES + 1;

    const first = data.subarray(0, TAPE_BLOCK_BYTES);
    expect([...record.slice(dataAt, dataAt + TAPE_BLOCK_BYTES)]).toEqual([
      ...first,
    ]);
    expect(record[dataAt + TAPE_BLOCK_BYTES]).toBe(checksum(first));

    // The last block is as short as what is left, and carries its own checksum.
    const restAt = dataAt + TAPE_BLOCK_BYTES + 1;
    const rest = data.subarray(TAPE_BLOCK_BYTES);
    expect([...record.slice(restAt, restAt + rest.length)]).toEqual([...rest]);
    expect(record[restAt + rest.length]).toBe(checksum(rest));
    expect(record).toHaveLength(restAt + rest.length + 1);
  });

  it('writes no blocks at all for an empty payload', () => {
    const record = buildTapeFile(new Uint8Array(0), OPTS);
    expect(record).toHaveLength(
      TAPE_LEAD_BYTES + 1 + TAPE_HEADER_BYTES + 1 + TAPE_LEAD_BYTES + 1,
    );
    expect([...parseTapeFile(record)]).toEqual([]);
  });

  it('round-trips a payload through build and parse', () => {
    for (const size of [1, 255, 256, 257, 1000]) {
      const data = payload(size);
      const record = parseTapeRecord(buildTapeFile(data, OPTS));
      expect([...record.payload], `${size} bytes`).toEqual([...data]);
      expect(record.name).toBe('HELLO');
      expect(record.loadAddress).toBe(PROGRAM_BASE);
      expect(record.execAddress).toBe(0x0000);
    }
  });

  it('rejects a record whose checksum is wrong', () => {
    const record = buildTapeFile(payload(4), OPTS);
    const badHeader = record.slice();
    badHeader[HEADER_AT + TAPE_HEADER_BYTES] ^= 0xff;
    expect(() => parseTapeFile(badHeader)).toThrow(TapeRecordError);
    expect(() => parseTapeFile(badHeader)).toThrow(/header checksum/);

    const badBlock = record.slice();
    badBlock[badBlock.length - 1] ^= 0xff;
    expect(() => parseTapeFile(badBlock)).toThrow(/data block checksum/);
  });

  it('rejects a record that is not one', () => {
    expect(() => parseTapeFile(Uint8Array.of(1, 2, 3))).toThrow(
      /does not open with a lead/,
    );
    const truncated = buildTapeFile(payload(4), OPTS).slice(0, HEADER_AT + 4);
    expect(() => parseTapeFile(truncated)).toThrow(/ends inside its header/);
  });

  it('fits a name to what the Monitor’s parser would store', () => {
    expect(tapeName('hello')).toBe('HELLO');
    expect(tapeName('hi')).toBe('HI   ');
    expect(tapeName('kaleidoscope')).toBe('KALEI');
    // The name has to start with a letter, so leading digits are dropped.
    expect(tapeName('3d maze')).toBe('DMAZE');
    // Nothing usable at all still produces a name the machine can ask for.
    expect(tapeName('!!!')).toBe('A    ');
    expect(tapeName('')).toBe('A    ');
    expect(tapeName('hello')).toHaveLength(TAPE_NAME_BYTES);
  });
});
