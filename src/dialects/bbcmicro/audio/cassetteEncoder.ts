/**
 * BBC Micro cassette encoding (Acorn cassette filing system over Kansas City
 * Standard FSK).
 *
 * Bytes are carried by FSK at 1200 baud: a `0` bit is one cycle of 1200 Hz, a
 * `1` bit is two cycles of 2400 Hz - so every bit lasts 1/1200 s. Each byte is
 * framed 8N1: a start bit (`0`), eight data bits LSB-first, a stop bit (`1`). A
 * continuous 2400 Hz carrier tone leads in and separates blocks.
 *
 * The program is carried as a cassette filing system (CFS) file: up to 256 data
 * bytes per block, each block prefixed with a `*` (0x2A) sync byte and a header
 * (filename, load/exec addresses, block number/length/flag, spare) protected by
 * a CRC-16, followed by the data and its own CRC-16. The last block sets bit 7
 * of the flag. Load/exec are PAGE-style (&FFFF0E00); CHAIN relocates a BASIC
 * program to PAGE on load regardless, so the value is advisory.
 */
import { TAPE_HOST_ADDR } from '../addresses';
import { KcsTape, type KcsFraming } from '../../audio/kansasCity';

const CYCLE_2400_MICROS = 1e6 / 2400;

/** 1200 baud, 8N1: a `0` is one 1200 Hz cycle, a `1` two at 2400 Hz. */
export const BBC_FRAMING: KcsFraming = {
  zeroCycles: 1,
  oneCycles: 2,
  stopBits: 1,
};

const SYNC = 0x2a; // '*'
const LOAD_ADDR = TAPE_HOST_ADDR;
const EXEC_ADDR = TAPE_HOST_ADDR;
const MAX_BLOCK_DATA = 256;

export interface BbcTapeOptions {
  sampleRate?: number; // default 44100
  amplitude?: number; // default 0.85
  /** Carrier tone before the first block, in ms. */
  leaderMs?: number; // default 2000
  /** Carrier tone between blocks, in ms. */
  interBlockMs?: number; // default 1000
  /** Trailing carrier tone, in ms. */
  trailerMs?: number; // default 500
}

/** CRC-16/CCITT (poly 0x1021, init 0x0000), MSB-first - the BBC tape CRC. */
export function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function nameBytes(name: string): Uint8Array {
  const cleaned =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10) || 'PROGRAM';
  return Uint8Array.from(cleaned, (c) => c.charCodeAt(0));
}

/** Build one CFS block: sync byte, header, header CRC, data, data CRC. */
export function buildCfsBlock(
  name: Uint8Array,
  blockNumber: number,
  data: Uint8Array,
  isLast: boolean,
): Uint8Array {
  const header: number[] = [];
  header.push(...name, 0x00); // filename + terminator
  const push32 = (v: number) =>
    header.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  const push16 = (v: number) => header.push(v & 0xff, (v >> 8) & 0xff);
  push32(LOAD_ADDR);
  push32(EXEC_ADDR);
  push16(blockNumber);
  push16(data.length);
  header.push((isLast ? 0x80 : 0x00) | (data.length === 0 ? 0x40 : 0x00)); // flag
  push32(0); // spare / next-file address

  const headerCrc = crc16(Uint8Array.from(header));
  const out: number[] = [
    SYNC,
    ...header,
    (headerCrc >> 8) & 0xff,
    headerCrc & 0xff,
  ];
  if (data.length > 0) {
    const dataCrc = crc16(data);
    out.push(...data, (dataCrc >> 8) & 0xff, dataCrc & 0xff);
  }
  return Uint8Array.from(out);
}

/** Split the program into CFS blocks (≤256 data bytes each). */
export function buildCfsBlocks(
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
    blocks.push(buildCfsBlock(nb, i, data, i === count - 1));
  }
  return blocks;
}

export function encodeBbcTape(
  programBytes: Uint8Array,
  name: string,
  opts: BbcTapeOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? 44100;
  const cycles = (ms: number) => Math.round((ms * 1000) / CYCLE_2400_MICROS);
  const leaderCycles = cycles(opts.leaderMs ?? 2000);
  const interCycles = cycles(opts.interBlockMs ?? 1000);
  const trailerCycles = cycles(opts.trailerMs ?? 500);

  const tape = new KcsTape(BBC_FRAMING);
  tape.tone(leaderCycles);
  buildCfsBlocks(programBytes, name).forEach((block, i) => {
    if (i > 0) tape.tone(interCycles);
    tape.bytes(block);
  });
  tape.tone(trailerCycles);

  return tape.render(sampleRate, opts.amplitude ?? 0.85);
}
