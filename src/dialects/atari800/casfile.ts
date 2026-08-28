// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Atari cassette record layer, and the `.cas` container an emulator's
 * virtual recorder reads.
 *
 * The Atari has no tape format of its own the way the Sinclair and Commodore
 * machines do: `CSAVE` hands the program to CIO, which hands it to the serial
 * bus, and the cassette handler cuts the stream into fixed 132-byte records.
 * Every record has the same shape whatever it carries:
 *
 * ```
 *   $55 $55   two sync bytes, which the reader times its baud rate off
 *   control   $FC full, $FA partial (the last one), $FE end of file
 *   128 data  the payload; a partial record's last byte is its byte count
 *   checksum  every byte above, summed with the carry added back in
 * ```
 *
 * There is no filename and no load address anywhere on the tape - the recorder
 * is a single device with no directory, so what a tape holds is decided by what
 * the user typed to start it. A `CSAVE`d tape holds exactly the bytes `SAVE`
 * writes to a disk: the 14-byte pointer header and the program area behind it.
 *
 * `.cas` wraps those records in a chunked container so an emulator can play
 * them back with the gaps the machine expects, each chunk being a four-byte
 * type, a 16-bit length, a 16-bit auxiliary word and the chunk's data.
 */

/** Sync bytes every record opens with. */
export const RECORD_SYNC = 0x55;

/** Control byte: 128 data bytes, all of them payload. */
export const CONTROL_FULL = 0xfc;

/** Control byte: the last data record, its byte count in the final data byte. */
export const CONTROL_PARTIAL = 0xfa;

/** Control byte: end of file - 128 zero bytes and nothing to keep. */
export const CONTROL_EOF = 0xfe;

/** Data bytes in one record, full or not. */
export const RECORD_DATA_BYTES = 128;

/** Bytes in one record: two sync, a control byte, the data, a checksum. */
export const RECORD_BYTES = RECORD_DATA_BYTES + 4;

/** The rate the cassette handler runs the serial bus at. */
export const CASSETTE_BAUD = 600;

/**
 * The SIO checksum: an 8-bit sum with the carry added back into the low byte,
 * so a run of bytes and the same run rotated do not collide the way a plain
 * sum would.
 */
export function atariChecksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum += bytes[i]!;
    sum = (sum & 0xff) + (sum >> 8);
  }
  return sum & 0xff;
}

/** One record around `data`, which must be exactly 128 bytes. */
function buildRecord(control: number, data: Uint8Array): Uint8Array {
  const record = new Uint8Array(RECORD_BYTES);
  record[0] = RECORD_SYNC;
  record[1] = RECORD_SYNC;
  record[2] = control;
  record.set(data, 3);
  record[RECORD_BYTES - 1] = atariChecksum(
    record.subarray(0, RECORD_BYTES - 1),
  );
  return record;
}

/**
 * Cut a payload into the records the cassette handler would write for it: full
 * records while 128 bytes remain, a partial record for the tail, and the
 * end-of-file record `CLOAD` stops on.
 */
export function buildCassetteRecords(payload: Uint8Array): Uint8Array[] {
  const records: Uint8Array[] = [];
  for (let at = 0; at < payload.length; at += RECORD_DATA_BYTES) {
    const chunk = payload.subarray(at, at + RECORD_DATA_BYTES);
    if (chunk.length === RECORD_DATA_BYTES) {
      records.push(buildRecord(CONTROL_FULL, chunk));
      continue;
    }
    const data = new Uint8Array(RECORD_DATA_BYTES);
    data.set(chunk);
    // A partial record says how much of itself is real in its last byte, which
    // is why a 128-byte tail is written as a full record and not as this.
    data[RECORD_DATA_BYTES - 1] = chunk.length;
    records.push(buildRecord(CONTROL_PARTIAL, data));
  }
  records.push(buildRecord(CONTROL_EOF, new Uint8Array(RECORD_DATA_BYTES)));
  return records;
}

/** What {@link collectRecordData} recovered, and anything that did not add up. */
export interface RecordScan {
  data: Uint8Array;
  warnings: string[];
}

/** Whether `record` is a well-formed 132-byte record with a good checksum. */
export function isValidRecord(record: Uint8Array): boolean {
  return (
    record.length === RECORD_BYTES &&
    record[0] === RECORD_SYNC &&
    record[1] === RECORD_SYNC &&
    atariChecksum(record.subarray(0, RECORD_BYTES - 1)) ===
      record[RECORD_BYTES - 1]
  );
}

/**
 * Join the records' payloads back into the byte stream `CSAVE` handed the
 * handler, stopping at the end-of-file record.
 *
 * A damaged record is reported and skipped rather than abandoning the whole
 * tape: the checksum says which one went wrong, and a program missing one
 * record is still worth showing the user.
 */
export function collectRecordData(records: readonly Uint8Array[]): RecordScan {
  const warnings: string[] = [];
  const parts: Uint8Array[] = [];
  let sawEof = false;

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    if (!isValidRecord(record)) {
      warnings.push(`Cassette record ${i + 1} is damaged and was skipped.`);
      continue;
    }
    const data = record.subarray(3, 3 + RECORD_DATA_BYTES);
    const control = record[2];
    if (control === CONTROL_EOF) {
      sawEof = true;
      break;
    }
    if (control === CONTROL_FULL) {
      parts.push(data);
    } else if (control === CONTROL_PARTIAL) {
      parts.push(data.subarray(0, data[RECORD_DATA_BYTES - 1]));
    } else {
      warnings.push(
        `Cassette record ${i + 1} has an unknown control byte and was skipped.`,
      );
    }
  }

  if (!sawEof && parts.length > 0) {
    warnings.push(
      'The recording ends without an end-of-file record, so the program may be incomplete.',
    );
  }

  const total = parts.reduce((n, p) => n + p.length, 0);
  const data = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    data.set(part, at);
    at += part.length;
  }
  return { data, warnings };
}

/** Milliseconds of tone a `.cas` asks for before each record. */
export interface CasGaps {
  /** Before the first record, while the recorder gets up to speed. */
  leaderMs: number;
  /** Between records, for the machine to digest the one it just read. */
  gapMs: number;
}

function chunkHeader(type: string, length: number, aux: number): number[] {
  return [
    ...Array.from(type, (c) => c.charCodeAt(0)),
    length & 0xff,
    (length >> 8) & 0xff,
    aux & 0xff,
    (aux >> 8) & 0xff,
  ];
}

/**
 * Wrap a payload as a `.cas` image: the FUJI description chunk, the baud rate,
 * then one `data` chunk per record carrying the gap that precedes it.
 */
export function buildCasImage(
  payload: Uint8Array,
  description: string,
  gaps: CasGaps,
): Uint8Array {
  const text = Uint8Array.from(description.slice(0, 0xffff), (c) =>
    c.charCodeAt(0),
  );
  const out: number[] = [
    ...chunkHeader('FUJI', text.length, 0),
    ...text,
    ...chunkHeader('baud', 0, CASSETTE_BAUD),
  ];
  const records = buildCassetteRecords(payload);
  records.forEach((record, i) => {
    out.push(
      ...chunkHeader(
        'data',
        record.length,
        i === 0 ? gaps.leaderMs : gaps.gapMs,
      ),
      ...record,
    );
  });
  return Uint8Array.from(out);
}

/** Whether `bytes` opens with the `.cas` container's FUJI chunk. */
export function isCasImage(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x46 && // F
    bytes[1] === 0x55 && // U
    bytes[2] === 0x4a && // J
    bytes[3] === 0x49 // I
  );
}

/** What a `.cas` image holds: its description, its records, and any complaint. */
export interface ParsedCas {
  description: string;
  records: Uint8Array[];
  warnings: string[];
}

/**
 * Read a `.cas` image back into its records.
 *
 * Chunk types this does not know are skipped by their own length, which is what
 * lets a file carrying the turbo-loader chunks (`fsk `, `pwms`) still give up
 * its standard records - though a file made only of those has none to give, and
 * says so.
 */
export function parseCasImage(bytes: Uint8Array): ParsedCas {
  const warnings: string[] = [];
  const records: Uint8Array[] = [];
  let description = '';
  let at = 0;

  while (at + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(at, at + 4));
    const length = bytes[at + 4]! | (bytes[at + 5]! << 8);
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (body.length < length) {
      warnings.push('The last chunk of the .cas file is truncated.');
      break;
    }
    if (type === 'FUJI') description = String.fromCharCode(...body);
    else if (type === 'data') records.push(Uint8Array.from(body));
    at += 8 + length;
  }

  if (records.length === 0) {
    warnings.push(
      'This .cas file holds no standard cassette records - it may be a turbo-loader tape.',
    );
  }
  return { description, records, warnings };
}
