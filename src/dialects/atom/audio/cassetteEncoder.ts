/**
 * Acorn Atom cassette encoding (Acorn cassette filing system over Kansas City
 * Standard FSK).
 *
 * The Atom records at **300 baud**: a `0` bit is four cycles of 1200 Hz, a `1`
 * bit is eight cycles of 2400 Hz — so every bit lasts 1/300 s (four times slower
 * than the BBC's 1200 baud, though the two tones are the same). Each byte is
 * framed 8N1: a start bit (`0`), eight data bits LSB-first, a stop bit (`1`). A
 * continuous 2400 Hz carrier tone leads in and separates blocks.
 *
 * A file is carried as a sequence of blocks of up to 256 data bytes. Each block
 * is four `*` (0x2A) synchronisation bytes, then a header — filename, a `0x0D`
 * terminator, a flag byte, the block number (two bytes, high first), the data
 * length minus one, the execution address and the load address (each two bytes,
 * high first) — followed by the data and a single checksum byte. The checksum is
 * the sum, modulo 256, of every byte from the start of the header to the end of
 * the data. The flag byte's bit 7 is set on every block except the last, and
 * bit 6 is set when the block carries data.
 *
 * (Real Atom hardware inserts a short carrier tone between a block's header and
 * its data; like the BBC encoder here we emit header and data contiguously,
 * which our decoder round-trips and which common Atom tools also accept.)
 */

import { ATOM_TEXT_START } from '../atm';
import { samplesToWav } from '../../../transfer/wav';
import { tokenizeProgram } from '../tokenizer';

const BIT_MICROS = 1e6 / 300; // one start/data/stop bit at 300 baud
const CYCLE_2400_MICROS = 1e6 / 2400;
const HALF_2400_MICROS = CYCLE_2400_MICROS / 2; // 2400 Hz half-cycle
const HALF_1200_MICROS = 1e6 / 1200 / 2; // 1200 Hz half-cycle

const SYNC = 0x2a; // '*'
const SYNC_COUNT = 4;
const EXEC_ADDR = ATOM_TEXT_START;
const MAX_BLOCK_DATA = 256;

export const CASSETTE_SAMPLE_RATE = 44100;

export interface AtomTapeOptions {
  sampleRate?: number; // default 44100
  amplitude?: number; // default 0.85
  /** Carrier tone before the first block, in ms. */
  leaderMs?: number; // default 2000
  /** Carrier tone between blocks, in ms. */
  interBlockMs?: number; // default 1500
  /** Trailing carrier tone, in ms. */
  trailerMs?: number; // default 500
}

function nameBytes(name: string): Uint8Array {
  const cleaned =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 13) || 'PROGRAM';
  return Uint8Array.from(cleaned, (c) => c.charCodeAt(0));
}

/** Sum (modulo 256) of a run of bytes — the Atom block checksum. */
export function atomChecksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum = (sum + bytes[i]!) & 0xff;
  return sum;
}

/** Build one Atom block: sync bytes, header, data and the trailing checksum. */
export function buildAtomBlock(
  name: Uint8Array,
  blockNumber: number,
  data: Uint8Array,
  isLast: boolean,
): Uint8Array {
  const loadAddr = ATOM_TEXT_START + blockNumber * MAX_BLOCK_DATA;
  // Header + data, all of which the checksum covers (the sync bytes do not).
  const body: number[] = [];
  body.push(...name, 0x0d); // filename + CR terminator
  body.push((isLast ? 0x00 : 0x80) | (data.length > 0 ? 0x40 : 0x00)); // flag
  body.push((blockNumber >> 8) & 0xff, blockNumber & 0xff); // block number, hi first
  body.push(data.length === 0 ? 0 : data.length - 1); // data length - 1
  body.push((EXEC_ADDR >> 8) & 0xff, EXEC_ADDR & 0xff); // exec address, hi first
  body.push((loadAddr >> 8) & 0xff, loadAddr & 0xff); // load address, hi first
  for (const b of data) body.push(b);

  return Uint8Array.from([
    ...new Array(SYNC_COUNT).fill(SYNC),
    ...body,
    atomChecksum(body),
  ]);
}

/** Split the program into Atom blocks (≤256 data bytes each). */
export function buildAtomBlocks(
  programBytes: Uint8Array,
  name: string,
): Uint8Array[] {
  const nb = nameBytes(name);
  const blocks: Uint8Array[] = [];
  const count = Math.max(1, Math.ceil(programBytes.length / MAX_BLOCK_DATA));
  for (let i = 0; i < count; i++) {
    const data = programBytes.slice(
      i * MAX_BLOCK_DATA,
      (i + 1) * MAX_BLOCK_DATA,
    );
    blocks.push(buildAtomBlock(nb, i, data, i === count - 1));
  }
  return blocks;
}

export function encodeAtomTape(
  programBytes: Uint8Array,
  name: string,
  opts: AtomTapeOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? CASSETTE_SAMPLE_RATE;
  const amplitude = opts.amplitude ?? 0.85;
  const leaderMicros = (opts.leaderMs ?? 2000) * 1000;
  const interBlockMicros = (opts.interBlockMs ?? 1500) * 1000;
  const trailerMicros = (opts.trailerMs ?? 500) * 1000;

  const blocks = buildAtomBlocks(programBytes, name);
  const samplesPerMicro = sampleRate / 1e6;

  // Pre-compute the total length so we allocate exactly once. Each carrier tone
  // is whole 2400 Hz cycles; each framed byte is 10 bits of BIT_MICROS.
  const leaderCycles = Math.round(leaderMicros / CYCLE_2400_MICROS);
  const interCycles = Math.round(interBlockMicros / CYCLE_2400_MICROS);
  const trailerCycles = Math.round(trailerMicros / CYCLE_2400_MICROS);
  let totalMicros =
    (leaderCycles + trailerCycles + interCycles * (blocks.length - 1)) *
    CYCLE_2400_MICROS;
  for (const block of blocks) totalMicros += block.length * 10 * BIT_MICROS;

  const out = new Float32Array(Math.ceil(totalMicros * samplesPerMicro) + 1);

  // Sample-accurate accumulation: positions tracked in exact micros, rounded at
  // emission so no per-half-cycle drift builds up.
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
  const writeCycle2400 = () => {
    writeHalf(HALF_2400_MICROS);
    writeHalf(HALF_2400_MICROS);
  };
  const writeBit = (bit: number) => {
    if (bit) {
      for (let i = 0; i < 8; i++) writeCycle2400(); // '1' = eight 2400 Hz cycles
    } else {
      for (let i = 0; i < 4; i++) {
        writeHalf(HALF_1200_MICROS);
        writeHalf(HALF_1200_MICROS); // '0' = four 1200 Hz cycles
      }
    }
  };
  const writeTone = (cycles: number) => {
    for (let i = 0; i < cycles; i++) writeCycle2400();
  };
  const writeByte = (b: number) => {
    writeBit(0); // start bit
    for (let i = 0; i < 8; i++) writeBit((b >> i) & 1); // LSB first
    writeBit(1); // stop bit
  };

  writeTone(leaderCycles);
  blocks.forEach((block, i) => {
    if (i > 0) writeTone(interCycles);
    for (const b of block) writeByte(b);
  });
  writeTone(trailerCycles);

  return out;
}

/**
 * Build the loadable program image. This is exactly the byte layout BASIC keeps
 * from `#2900` (and that the emulator pokes in), so it doubles as the tape
 * payload and the bare native export.
 */
export function buildAtomImage(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  if (errors.length > 0) {
    throw new Error(
      `Program has ${errors.length} error(s) — fix them before building`,
    );
  }
  // A bare end marker (0x0D 0xFF) means the program is empty.
  if (bytes.length <= 2) {
    throw new Error('Program is empty');
  }
  return bytes;
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  return encodeAtomTape(buildAtomImage(source), programName, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderMs: robust ? 4000 : 2000,
    interBlockMs: robust ? 3000 : 1500,
  });
}

/** Encode a program straight to a `.wav` cassette blob. */
export function buildCassetteWav(source: string, programName: string): Blob {
  return samplesToWav(
    buildCassetteSamples(source, programName),
    CASSETTE_SAMPLE_RATE,
  );
}
