/**
 * Commodore 64 cassette encoding (the authentic KERNAL datasette format).
 *
 * The datasette records a square wave whose information is in the *spacing*
 * between edges, not their amplitude. Three pulse lengths are used - short (S),
 * medium (M) and long (L) - each emitted here as one full square-wave cycle
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
import type { MemoryBlock } from '../../types';
import { buildPrg } from '../targets';
import { loaderProgramBytes } from '../loader';
import { parseC64Char } from '../petscii';
import { PROGRAM_BASE } from '../addresses';

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
const FILE_TYPE_NON_RELOCATABLE = 0x03; // absolute load at the header's address
const LOAD_ADDRESS = PROGRAM_BASE;
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

/** XOR checksum over the bytes - the KERNAL's tape block check byte. */
export function checksum(data: Uint8Array): number {
  let acc = 0;
  for (const b of data) acc ^= b;
  return acc & 0xff;
}

/**
 * Filename bytes for the tape header: the name routed through the PETSCII
 * charset (so punctuation, `{...}` escapes and the £/↑/← glyphs a real C64
 * filename can hold survive), truncated and space-padded to 16 bytes. An
 * unmappable character is skipped; an empty result falls back to PROGRAM.
 */
export function nameBytes(name: string): Uint8Array {
  const codes: number[] = [];
  let i = 0;
  while (i < name.length && codes.length < FILENAME_LENGTH) {
    try {
      const { code, length } = parseC64Char(name, i);
      codes.push(code);
      i += length;
    } catch {
      i++; // skip a character with no PETSCII equivalent
    }
  }
  const out = new Uint8Array(FILENAME_LENGTH).fill(FILENAME_PAD);
  if (codes.length === 0) {
    const fallback = 'PROGRAM';
    for (let k = 0; k < fallback.length; k++) out[k] = fallback.charCodeAt(k);
    return out;
  }
  for (let k = 0; k < codes.length; k++) out[k] = codes[k]!;
  return out;
}

/**
 * Build the 192-byte header block body (without countdown or checksum).
 * `fileType` is $01 for a BASIC program (relocated to $0801 on load) or $03 for
 * an absolute code file loaded at the header's own address.
 */
export function buildHeaderBlock(
  name: string,
  startAddr: number,
  endAddr: number,
  fileType: number = FILE_TYPE_RELOCATABLE,
): Uint8Array {
  const header = new Uint8Array(HEADER_SIZE).fill(FILENAME_PAD);
  header[0] = fileType;
  header[1] = startAddr & 0xff;
  header[2] = (startAddr >> 8) & 0xff;
  header[3] = endAddr & 0xff;
  header[4] = (endAddr >> 8) & 0xff;
  header.set(nameBytes(name), FILENAME_OFFSET);
  return header;
}

/** One tape file: its 192-byte header block and its data block. */
interface TapeFileBlocks {
  header: Uint8Array;
  data: Uint8Array;
}

/**
 * Assemble the ordered KERNAL tape-block bodies for a whole Commodore document:
 * the main BASIC program (header $01 at `loadAddress` + data), then each memory
 * block as an absolute code file (header $03 at its address + data), with an
 * optional generated auto-run loader (header $01 at `loadAddress` + its bytes)
 * leading the tape. The result is the flat `[header, data, header, data, …]`
 * body list {@link encodeC64Bodies} renders - the same ordered layout
 * {@link exportD64Entries} writes to the `.d64` disk. Without blocks it is the
 * classic single program, so the leading file still decodes as before.
 *
 * Address-parameterized so the PET ($0401) and VIC-20 ($1001) siblings share
 * this one source of truth: they pass their own load address, `program` bytes
 * (from their `buildPrg`) and, when a loader is wanted, their own tokenized
 * `loaderBytes` (from their dialect's loader). Passing `loaderBytes` null (or
 * omitting it) puts the code files after the program with no loader.
 */
export function buildCbmTapeBodies(opts: {
  program: Uint8Array;
  programName: string;
  loadAddress: number;
  blocks?: readonly MemoryBlock[];
  loaderBytes?: Uint8Array | null;
}): Uint8Array[] {
  const { program, programName, loadAddress } = opts;
  const blocks = opts.blocks ?? [];
  const loaderBytes = opts.loaderBytes ?? null;

  const programFile: TapeFileBlocks = {
    header: buildHeaderBlock(
      programName,
      loadAddress,
      loadAddress + program.length,
    ),
    data: program,
  };

  const files: TapeFileBlocks[] = [];
  if (blocks.length === 0) {
    files.push(programFile);
  } else {
    const sorted = [...blocks].sort((a, b) => a.address - b.address);
    const codeFile = (b: MemoryBlock): TapeFileBlocks => ({
      header: buildHeaderBlock(
        b.name,
        b.address,
        b.address + b.bytes.length,
        FILE_TYPE_NON_RELOCATABLE,
      ),
      data: b.bytes,
    });
    if (loaderBytes) {
      files.push({
        header: buildHeaderBlock(
          `${programName}.L`,
          loadAddress,
          loadAddress + loaderBytes.length,
        ),
        data: loaderBytes,
      });
      for (const b of sorted) files.push(codeFile(b));
      files.push(programFile);
    } else {
      files.push(programFile);
      for (const b of sorted) files.push(codeFile(b));
    }
  }

  return files.flatMap((f) => [f.header, f.data]);
}

/**
 * Encode a document to cassette samples (the dialect's `buildSamples`). The
 * program is one tape file (header $01 at $0801 + data); with memory blocks each
 * becomes a further file (header $03 at its address + data), and with `loader`
 * on a generated auto-run loader program leads the tape - the same ordered
 * layout {@link exportD64Entries} writes to the `.d64` disk. Without blocks it
 * is the classic single program, so the leading file still decodes as before.
 */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
  blocks: readonly MemoryBlock[] = [],
  loader = false,
): Float32Array {
  const program = buildPrg(source).subarray(2); // drop the $0801 load address
  const sorted = [...blocks].sort((a, b) => a.address - b.address);
  const bodies = buildCbmTapeBodies({
    program,
    programName,
    loadAddress: LOAD_ADDRESS,
    blocks,
    loaderBytes:
      loader && blocks.length > 0
        ? loaderProgramBytes(programName, sorted)
        : null,
  });

  return encodeC64Bodies(bodies, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderPulses: robust ? 2400 : 1200,
  });
}

/**
 * Encode a header block and a data block to a square-wave Float32Array. Both
 * blocks are written twice (with countdown + checksum) exactly as the KERNAL
 * SAVE routine lays them out. A convenience wrapper over {@link encodeC64Bodies}
 * for the common single-file (header + program) case.
 */
export function encodeC64Tape(
  header: Uint8Array,
  program: Uint8Array,
  opts: C64TapeOptions = {},
): Float32Array {
  return encodeC64Bodies([header, program], opts);
}

/**
 * Encode an ordered list of block bodies to a square-wave Float32Array. Each
 * body is a KERNAL tape block (a 192-byte header or a data block) and is written
 * twice - with the $89..$81 / $09..$01 countdown prefix and an XOR checksum -
 * exactly as the SAVE routine lays them out. A multi-file tape is just a longer
 * body list: `[header1, data1, header2, data2, …]`.
 */
export function encodeC64Bodies(
  bodies: readonly Uint8Array[],
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

  for (const body of bodies) pushBlock(body);
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
