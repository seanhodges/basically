// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple Cassette Interface as logic rather than as its PROM: the board's
 * FSK encoding, written here so no copyrighted image is needed to produce a
 * tape a real ACI can read. Every timing constant here carries the ACI
 * documentation it was read from.
 */
export const CASSETTE_SAMPLE_RATE = 44100;

export function buildCassetteSamples(
  _source: string,
  _programName: string,
  _robust: boolean,
): Float32Array {
  throw new Error('apple1: not implemented');
}
