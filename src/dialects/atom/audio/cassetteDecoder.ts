import { atomChecksum } from './cassetteEncoder';

/**
 * Acorn Atom cassette decoding — the inverse of {@link encodeAtomTape}.
 *
 * Bytes are carried by Kansas City Standard FSK at 300 baud: a `0` bit is four
 * 1200 Hz cycles (eight ~417µs half-cycles), a `1` bit is eight 2400 Hz cycles
 * (sixteen ~208µs half-cycles). Each byte is framed 8N1 (start `0`, eight data
 * bits LSB-first, stop `1`), with a continuous 2400 Hz carrier — a run of `1`
 * bits — leading in and between blocks.
 *
 * We classify each half-cycle as fast (2400 Hz) or slow (1200 Hz) **relative to
 * the carrier**: the carrier dominates the recording, so the median half-cycle
 * is a fast one, and a threshold at 1.5× that survives playback/clock-speed
 * drift, resampling and sample-rate mismatch. The framed bytes are parsed as
 * Atom blocks — four `*` (0x2A) sync bytes then a header whose trailing checksum
 * (a plain sum mod 256 over the header and data) has to verify, which is what
 * lets us reject noise and find the block boundaries.
 */
const SYNC = 0x2a; // '*'
const SYNC_COUNT = 4;
const NO_ATOM_SIGNAL = 'No cassette signal detected';

export interface DecodeCassetteResult {
  /** Program name from the first block's header. */
  name: string;
  /** The program image reassembled from the data blocks. */
  data: Uint8Array;
}

export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const bytes = decodeBytes(samples, sampleRate);
  const file = parseAtomFile(bytes);
  if (!file) throw new Error(NO_ATOM_SIGNAL);
  return file;
}

/** Recover the framed byte stream from the FSK waveform. */
function decodeBytes(samples: Float32Array, sampleRate: number): Uint8Array {
  const halves = halfCycles(samples, sampleRate); // true = fast (2400 Hz)
  const bytes: number[] = [];
  let k = 0;

  // Consume 8 slow halves (→ '0', four 1200 Hz cycles) or 16 fast halves
  // (→ '1', eight 2400 Hz cycles).
  const readBit = (): number | null => {
    if (k >= halves.length) return null;
    if (!halves[k]) {
      k += 8;
      return 0;
    }
    k += 16;
    return 1;
  };

  while (k < halves.length) {
    if (halves[k]) {
      k++; // skip carrier / stop bits until a start bit (slow half)
      continue;
    }
    if (readBit() !== 0) continue; // start bit must be '0'
    let v = 0;
    let ok = true;
    for (let b = 0; b < 8; b++) {
      const bit = readBit();
      if (bit === null) {
        ok = false;
        break;
      }
      v |= bit << b; // LSB first
    }
    if (!ok) break;
    readBit(); // stop bit
    bytes.push(v);
  }
  return Uint8Array.from(bytes);
}

/**
 * Collapse the high-passed, Schmitt-gated signal into half-cycles, each tagged
 * fast (2400 Hz) or slow (1200 Hz). The threshold is derived from the signal:
 * the carrier makes fast halves the most common, so the median is a fast half.
 */
function halfCycles(samples: Float32Array, sampleRate: number): boolean[] {
  const hp = highPass(samples, sampleRate, 5);
  const peak = percentileAbs(hp, 0.99);
  if (peak < 1e-4) return [];
  const gate = peak * 0.25;

  const lengths: number[] = [];
  let state = 0; // -1 low, +1 high, 0 unknown
  let last = -1;
  for (let i = 0; i < hp.length; i++) {
    const v = hp[i]!;
    let edge = false;
    if (state <= 0 && v > gate) {
      edge = state === -1;
      state = 1;
    } else if (state >= 0 && v < -gate) {
      edge = state === 1;
      state = -1;
    }
    if (edge) {
      if (last >= 0) lengths.push(i - last);
      last = i;
    }
  }
  if (lengths.length === 0) return [];

  const sorted = [...lengths].sort((a, b) => a - b);
  const fastHalf = sorted[sorted.length >> 1]!; // median ≈ a 2400 Hz half-cycle
  const threshold = fastHalf * 1.5; // 1200 Hz half is ≈2× the 2400 Hz half
  return lengths.map((d) => d < threshold);
}

/**
 * Parse the byte stream as an Atom file. Scans for the four `*` sync bytes
 * followed by a block whose checksum verifies, concatenating each block's data
 * in order until the last-block flag is seen.
 */
function parseAtomFile(bytes: Uint8Array): DecodeCassetteResult | null {
  const blocks: { num: number; data: Uint8Array }[] = [];
  let name = '';
  let i = 0;
  while (i + SYNC_COUNT < bytes.length) {
    let sync = true;
    for (let s = 0; s < SYNC_COUNT; s++) {
      if (bytes[i + s] !== SYNC) {
        sync = false;
        break;
      }
    }
    if (!sync) {
      i++;
      continue;
    }
    const blk = parseBlock(bytes, i + SYNC_COUNT);
    if (!blk) {
      i++;
      continue;
    }
    if (blk.num === 0) name = blk.name;
    blocks.push({ num: blk.num, data: blk.data });
    i = blk.end;
    if (blk.isLast) break;
  }
  if (blocks.length === 0) return null;

  blocks.sort((a, b) => a.num - b.num);
  const total = blocks.reduce((n, b) => n + b.data.length, 0);
  const data = new Uint8Array(total);
  let p = 0;
  for (const b of blocks) {
    data.set(b.data, p);
    p += b.data.length;
  }
  return { name, data };
}

interface ParsedBlock {
  name: string;
  num: number;
  data: Uint8Array;
  isLast: boolean;
  /** Index just past this block's checksum. */
  end: number;
}

/** Try to parse one Atom block whose header starts at `p` (just after the sync bytes). */
function parseBlock(bytes: Uint8Array, p: number): ParsedBlock | null {
  // Filename: up to 13 chars terminated by 0x0D.
  let q = p;
  const nameBytes: number[] = [];
  while (q < bytes.length && bytes[q] !== 0x0d) {
    if (nameBytes.length >= 13) return null;
    nameBytes.push(bytes[q]!);
    q++;
  }
  if (q >= bytes.length) return null;
  q++; // skip the 0x0D terminator

  // Fixed header: flag(1) blockNum(2) lenMinus1(1) exec(2) load(2).
  if (q + 8 > bytes.length) return null;
  const flag = bytes[q]!;
  const num = (bytes[q + 1]! << 8) | bytes[q + 2]!;
  const hasData = (flag & 0x40) !== 0;
  const len = hasData ? bytes[q + 3]! + 1 : 0;
  const dataStart = q + 8;
  const checksumPos = dataStart + len;
  if (checksumPos >= bytes.length) return null;

  const body = bytes.subarray(p, checksumPos); // filename..data (no sync, no checksum)
  if (atomChecksum(body) !== bytes[checksumPos]) return null;

  return {
    name: String.fromCharCode(...nameBytes),
    num,
    data: bytes.slice(dataStart, dataStart + len),
    isLast: (flag & 0x80) === 0,
    end: checksumPos + 1,
  };
}

/** One-pole high-pass: subtract a slow running mean to kill DC / baseline drift. */
function highPass(
  x: Float32Array,
  sampleRate: number,
  ms: number,
): Float32Array {
  const rc = ms / 1000;
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(x.length);
  const warm = Math.min(x.length, Math.round(2 * rc * sampleRate));
  let lp = 0;
  for (let i = 0; i < warm; i++) lp += x[i]!;
  lp = warm > 0 ? lp / warm : 0;
  for (let i = 0; i < x.length; i++) {
    lp += alpha * (x[i]! - lp);
    out[i] = x[i]! - lp;
  }
  return out;
}

function percentileAbs(x: Float32Array, p: number): number {
  const a = Float32Array.from(x, Math.abs).sort();
  const idx = Math.min(
    a.length - 1,
    Math.max(0, Math.floor(p * (a.length - 1))),
  );
  return a[idx]!;
}
