// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Exidy cassette record. Not implemented yet.
 *
 * A 100-byte 0x00 lead plus one 0x01, then a 16-byte header - five bytes of
 * name, the 0x55 0x00 type mark, file length, load address and execution
 * address as little-endian words, zero padding, and a checksum - then a second
 * lead, then the data in 256-byte blocks each with its own checksum. The
 * checksum starts at zero and, for each byte written, subtracts the running
 * value from that byte and inverts every bit of the result.
 */
export function buildTapeFile(
  _payload: Uint8Array,
  _opts: { programName: string; loadAddress: number; execAddress: number },
): Uint8Array {
  throw new Error('sorcerer: tape file builder not implemented');
}

/** Parse a tape record back into its payload. Throws on a bad checksum. */
export function parseTapeFile(_bytes: Uint8Array): Uint8Array {
  throw new Error('sorcerer: tape file parser not implemented');
}
