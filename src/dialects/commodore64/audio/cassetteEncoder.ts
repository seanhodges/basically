/**
 * Commodore 64 cassette encoding (the authentic KERNAL datasette format).
 *
 * The datasette records a square wave whose information is in the *spacing*
 * between edges, not their amplitude. Three pulse lengths are used — short (S),
 * medium (M) and long (L) — each emitted here as one full square-wave cycle
 * (two equal half-cycles of opposite sign):
 *
 *   bit 0           = S, M       bit 1            = M, S
 *   new-data marker = L, M       end-of-data mark = L, S
 *
 * A byte on tape is a new-data marker (L,M) followed by eight data bits
 * LSB-first and an odd-parity bit (chosen so data + parity has an odd number of
 * set bits). Each block is a long pilot tone of short pulses, then the bytes,
 * then an end-of-data marker. The KERNAL writes every block twice for
 * redundancy: the first copy is prefixed with the countdown $89..$81 and the
 * second with $09..$01, and each copy carries an XOR checksum byte.
 *
 * A program is two blocks: a 192-byte header (file type, start/end address,
 * filename) and the tokenized program bytes from $0801. The exported audio is
 * what a real C64 (or an emulator's datasette fed this as audio) reads with
 * LOAD, and the round-trip through {@link cassetteDecoder} reproduces it.
 */
import { buildPrg } from '../targets';

export const CASSETTE_SAMPLE_RATE = 44100;

// Pulse periods (one full square-wave cycle), in microseconds. These follow the
// KERNAL PAL timing constants ($30/$42/$56 timer values × 8 clock cycles at
// ~985 kHz); the decoder classifies pulses by their *ratios*, so the exact
// values only have to be these three well-separated lengths.
export const PULSE_SHORT_MICROS = 360;
export const PULSE_MEDIUM_MICROS = 520;
export const PULSE_LONG_MICROS = 680;

// Block-header layout.
const HEADER_SIZE = 192;
const FILE_TYPE_RELOCATABLE = 0x01; // BASIC program, relocated to $0801 on load
const LOAD_ADDRESS = 0x0801;
const FILENAME_OFFSET = 5;
const FILENAME_LENGTH = 16;
const FILENAME_PAD = 0x20; // space

// Countdown sequences that introduce the first and second copy of a block.
const COUNTDOWN_FIRST = [0x89, 0x88, 0x87, 0x86, 0x85, 0x84, 0x83, 0x82, 0x81];
const COUNTDOWN_SECOND = [0x09, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01];

export interface C64TapeOptions {
  sampleRate?: number; // default 44100
  amplitude?: number; // default 0.85
  /** Pilot pulses (short cycles) before each block's first copy. */
  leaderPulses?: number; // default 1200
  /** Pilot pulses between the two copies of a block. */
  interCopyPulses?: number; // default 200
  /** Trailing pilot pulses after the last block. */
  trailerPulses?: number; // default 100
}

/** XOR checksum over the bytes — the KERNAL's tape block check byte. */
export function checksum(data: Uint8Array): number {
  let acc = 0;
  for (const b of data) acc ^= b;
  return acc & 0xff;
}

/** Filename bytes: upper-case A–Z/0–9, padded with spaces to 16 bytes. */
export function nameBytes(name: string): Uint8Array {
  const cleaned =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, FILENAME_LENGTH) || 'PROGRAM';
  const out = new Uint8Array(FILENAME_LENGTH).fill(FILENAME_PAD);
  for (let i = 0; i < cleaned.length; i++) out[i] = cleaned.charCodeAt(i);
  return out;
}

/** Build the 192-byte header block body (without countdown or checksum). */
export function buildHeaderBlock(
  name: string,
  startAddr: number,
  endAddr: number,
): Uint8Array {
  const header = new Uint8Array(HEADER_SIZE).fill(FILENAME_PAD);
  header[0] = FILE_TYPE_RELOCATABLE;
  header[1] = startAddr & 0xff;
  header[2] = (startAddr >> 8) & 0xff;
  header[3] = endAddr & 0xff;
  header[4] = (endAddr >> 8) & 0xff;
  header.set(nameBytes(name), FILENAME_OFFSET);
  return header;
}

/** Encode source to cassette samples (the dialect's `buildSamples`). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  const program = buildPrg(source).subarray(2); // drop the $0801 load address
  const header = buildHeaderBlock(
    programName,
    LOAD_ADDRESS,
    LOAD_ADDRESS + program.length,
  );
  return encodeC64Tape(header, program, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderPulses: robust ? 2400 : 1200,
  });
}

/**
 * Encode a header block and a data block to a square-wave Float32Array. Both
 * blocks are written twice (with countdown + checksum) exactly as the KERNAL
 * SAVE routine lays them out.
 */
export function encodeC64Tape(
  header: Uint8Array,
  program: Uint8Array,
  opts: C64TapeOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? 44100;
  const amplitude = opts.amplitude ?? 0.85;
  const leaderPulses = opts.leaderPulses ?? 1200;
  const interCopyPulses = opts.interCopyPulses ?? 200;
  const trailerPulses = opts.trailerPulses ?? 100;

  // Build the full pulse list (each entry is a period in microseconds), then
  // render once. A byte is 20 pulses (L,M marker + 9 dipoles); pilot/markers are
  // plain pulses, so the list stays small enough to materialise.
  const periods: number[] = [];
  const pushPulse = (p: number) => periods.push(p);
  const pushDipole = (a: number, b: number) => {
    pushPulse(a);
    pushPulse(b);
  };
  const pushByte = (b: number) => {
    pushDipole(PULSE_LONG_MICROS, PULSE_MEDIUM_MICROS); // new-data marker
    let ones = 0;
    for (let i = 0; i < 8; i++) {
      const bit = (b >> i) & 1; // LSB first
      ones += bit;
      if (bit) pushDipole(PULSE_MEDIUM_MICROS, PULSE_SHORT_MICROS);
      else pushDipole(PULSE_SHORT_MICROS, PULSE_MEDIUM_MICROS);
    }
    const parity = ones % 2 === 0 ? 1 : 0; // odd parity over data + parity
    if (parity) pushDipole(PULSE_MEDIUM_MICROS, PULSE_SHORT_MICROS);
    else pushDipole(PULSE_SHORT_MICROS, PULSE_MEDIUM_MICROS);
  };
  const pushPilot = (count: number) => {
    for (let i = 0; i < count; i++) pushPulse(PULSE_SHORT_MICROS);
  };
  const pushBlock = (body: Uint8Array) => {
    const check = checksum(body);
    const copy = (countdown: number[]) => {
      for (const b of countdown) pushByte(b);
      for (const b of body) pushByte(b);
      pushByte(check);
      pushDipole(PULSE_LONG_MICROS, PULSE_SHORT_MICROS); // end-of-data marker
    };
    pushPilot(leaderPulses);
    copy(COUNTDOWN_FIRST);
    pushPilot(interCopyPulses);
    copy(COUNTDOWN_SECOND);
  };

  pushBlock(header);
  pushBlock(program);
  pushPilot(trailerPulses);

  // Render the pulses to a square wave. Time is accumulated in exact micros and
  // rounded only at emission, so no per-pulse drift builds up.
  const samplesPerMicro = sampleRate / 1e6;
  let totalMicros = 0;
  for (const p of periods) totalMicros += p;
  const out = new Float32Array(Math.ceil(totalMicros * samplesPerMicro) + 1);

  let micros = 0;
  let level = amplitude;
  const writeHalf = (durMicros: number) => {
    const start = micros;
    const end = start + durMicros;
    out.fill(
      level,
      Math.round(start * samplesPerMicro),
      Math.round(end * samplesPerMicro),
    );
    micros = end;
    level = -level;
  };
  for (const p of periods) {
    writeHalf(p / 2);
    writeHalf(p / 2);
  }
  return out;
}
