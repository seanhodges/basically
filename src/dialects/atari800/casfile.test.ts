// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  CONTROL_EOF,
  CONTROL_FULL,
  CONTROL_PARTIAL,
  RECORD_BYTES,
  RECORD_DATA_BYTES,
  atariChecksum,
  buildCasImage,
  buildCassetteRecords,
  collectRecordData,
  isCasImage,
  parseCasImage,
} from './casfile';

const GAPS = { leaderMs: 5000, gapMs: 250 };

/** A payload whose bytes are all different, so a lost record shows up. */
function payload(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, i) => (i * 7 + 1) & 0xff);
}

describe('atariChecksum', () => {
  it('folds the carry back in rather than dropping it', () => {
    // 0xFF + 0x01 is 0x100: the carry comes back as the low bit, not as zero.
    expect(atariChecksum([0xff, 0x01])).toBe(0x01);
    expect(atariChecksum([0xff, 0xff])).toBe(0xff);
    expect(atariChecksum([])).toBe(0);
  });
});

describe('buildCassetteRecords', () => {
  it('writes full records, a partial tail and an end-of-file record', () => {
    const records = buildCassetteRecords(payload(200));
    expect(records.map((r) => r[2])).toEqual([
      CONTROL_FULL,
      CONTROL_PARTIAL,
      CONTROL_EOF,
    ]);
    for (const record of records) {
      expect(record).toHaveLength(RECORD_BYTES);
      expect([record[0], record[1]]).toEqual([0x55, 0x55]);
      expect(atariChecksum(record.subarray(0, RECORD_BYTES - 1))).toBe(
        record[RECORD_BYTES - 1],
      );
    }
    // The partial record says how much of itself is real in its last byte.
    expect(records[1]![3 + RECORD_DATA_BYTES - 1]).toBe(200 - 128);
  });

  it('writes a whole-record tail as a full record, not a partial one', () => {
    const records = buildCassetteRecords(payload(RECORD_DATA_BYTES * 2));
    expect(records.map((r) => r[2])).toEqual([
      CONTROL_FULL,
      CONTROL_FULL,
      CONTROL_EOF,
    ]);
  });

  it('round-trips a payload through the records', () => {
    for (const length of [1, 127, 128, 129, 512, 1000]) {
      const bytes = payload(length);
      const { data, warnings } = collectRecordData(buildCassetteRecords(bytes));
      expect(warnings).toEqual([]);
      expect(Array.from(data)).toEqual(Array.from(bytes));
    }
  });
});

describe('collectRecordData', () => {
  it('skips a record whose checksum does not verify, and says so', () => {
    const records = buildCassetteRecords(payload(200));
    records[0]![10] ^= 0xff; // a dropout in the first record's data
    const { data, warnings } = collectRecordData(records);
    expect(warnings).toEqual(['Cassette record 1 is damaged and was skipped.']);
    expect(data).toHaveLength(200 - RECORD_DATA_BYTES);
  });

  it('reports a recording that stops before the end-of-file record', () => {
    const records = buildCassetteRecords(payload(200)).slice(0, -1);
    const { warnings } = collectRecordData(records);
    expect(warnings).toEqual([
      'The recording ends without an end-of-file record, so the program may be incomplete.',
    ]);
  });
});

describe('the .cas container', () => {
  it('round-trips a payload, its description and its gaps', () => {
    const bytes = payload(300);
    const image = buildCasImage(bytes, 'HELLO', GAPS);
    expect(isCasImage(image)).toBe(true);

    const parsed = parseCasImage(image);
    expect(parsed.description).toBe('HELLO');
    expect(parsed.warnings).toEqual([]);
    expect(parsed.records).toHaveLength(4); // two full, one partial, one EOF
    expect(Array.from(collectRecordData(parsed.records).data)).toEqual(
      Array.from(bytes),
    );

    // The leader precedes the first record and the shorter gap the rest.
    const auxOf = (index: number) => {
      let at = 0;
      let seen = 0;
      while (at + 8 <= image.length) {
        const type = String.fromCharCode(...image.subarray(at, at + 4));
        const length = image[at + 4]! | (image[at + 5]! << 8);
        if (type === 'data' && seen++ === index) {
          return image[at + 6]! | (image[at + 7]! << 8);
        }
        at += 8 + length;
      }
      return -1;
    };
    expect(auxOf(0)).toBe(GAPS.leaderMs);
    expect(auxOf(1)).toBe(GAPS.gapMs);
  });

  it('skips chunks it does not know', () => {
    const image = buildCasImage(payload(10), '', GAPS);
    const foreign = Uint8Array.from([
      ...image.subarray(0, 8),
      ...'fsk '.split('').map((c) => c.charCodeAt(0)),
      4,
      0,
      0,
      0,
      1,
      2,
      3,
      4,
      ...image.subarray(8),
    ]);
    expect(parseCasImage(foreign).records).toHaveLength(
      parseCasImage(image).records.length,
    );
  });

  it('complains about a file with no standard records in it', () => {
    // A FUJI chunk and nothing else - the shape a turbo-loader tape is left
    // with once the chunks this cannot play are skipped.
    const fujiOnly = Uint8Array.from([0x46, 0x55, 0x4a, 0x49, 0, 0, 0, 0]);
    expect(isCasImage(fujiOnly)).toBe(true);
    expect(parseCasImage(fujiOnly).warnings).toEqual([
      'This .cas file holds no standard cassette records - it may be a turbo-loader tape.',
    ]);
    expect(isCasImage(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(false);
  });

  it('reports a chunk that runs off the end of the file', () => {
    const image = buildCasImage(payload(10), '', GAPS);
    const cut = image.subarray(0, image.length - 4);
    expect(parseCasImage(cut).warnings).toContain(
      'The last chunk of the .cas file is truncated.',
    );
  });
});
