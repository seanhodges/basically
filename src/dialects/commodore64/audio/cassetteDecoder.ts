/**
 * Commodore 64 cassette decoding — the inverse of {@link encodeC64Tape}.
 *
 * The recording is a square wave whose information is the spacing between edges.
 * We high-pass the signal to kill DC / baseline drift, Schmitt-gate it to a
 * clean square, and measure the interval between successive *rising* edges —
 * one per full pulse — giving a stream of pulse lengths. Each is classified
 * short / medium / long **relative to the others**: the pilot tone makes short
 * pulses by far the most common, so the lower cluster sets the short reference
 * and the thresholds scale with it. That makes the decode immune to playback
 * speed drift, resampling and sample-rate mismatch.
 *
 * Pulses are read back as dipoles (S,M → 0; M,S → 1), framed by new-data
 * markers (L,M) before every byte and an end-of-data marker (L,S) at the end of
 * each copy. Each copy is checksum-validated after stripping its countdown
 * prefix, and the header (192 bytes, file type $01) yields the filename while
 * the data block yields the program; whichever copy checks out wins.
 */
import { checksum } from './cassetteEncoder';

const NO_C64_SIGNAL = 'No cassette signal detected';
const HEADER_SIZE = 192;
const FILE_TYPE_RELOCATABLE = 0x01;
const FILENAME_OFFSET = 5;
const FILENAME_LENGTH = 16;
const COUNTDOWN_FIRST = [0x89, 0x88, 0x87, 0x86, 0x85, 0x84, 0x83, 0x82, 0x81];
const COUNTDOWN_SECOND = [0x09, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01];

export interface DecodeCassetteResult {
  /** Program name from the header block. */
  name: string;
  /** The tokenized program bytes from $0801 (no load address). */
  data: Uint8Array;
}

type PulseKind = 'S' | 'M' | 'L';

export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const pulses = classifyPulses(pulseLengths(samples, sampleRate));
  const segments = readSegments(pulses);

  let name: string | null = null;
  let data: Uint8Array | null = null;
  for (const body of segments) {
    const isHeader =
      body.length === HEADER_SIZE && body[0] === FILE_TYPE_RELOCATABLE;
    if (isHeader) {
      if (name === null) name = readName(body);
    } else if (data === null) {
      data = body;
    }
  }

  if (data === null) throw new Error(NO_C64_SIGNAL);
  return { name: name ?? '', data };
}

function readName(header: Uint8Array): string {
  const raw = header.subarray(
    FILENAME_OFFSET,
    FILENAME_OFFSET + FILENAME_LENGTH,
  );
  return String.fromCharCode(...raw)
    .replace(/\s+$/, '')
    .trim();
}

/**
 * Walk the pulse-kind stream, splitting at end-of-data (L,S) markers. Each
 * segment is a run of bytes; we strip the leading countdown and verify the XOR
 * checksum, keeping only the validated body.
 */
function readSegments(pulses: PulseKind[]): Uint8Array[] {
  const segments: Uint8Array[] = [];
  let cur: number[] = [];
  let i = 0;

  const finish = () => {
    if (cur.length === 0) return;
    const body = stripCountdownAndCheck(cur);
    if (body) segments.push(body);
    cur = [];
  };

  while (i < pulses.length) {
    if (pulses[i] !== 'L') {
      i++; // pilot short pulses / stray pulses between frames
      continue;
    }
    const next = pulses[i + 1];
    if (next === 'M') {
      // New-data marker: read the nine dipoles that follow.
      i += 2;
      const byte = readByte(pulses, i);
      if (byte === null) {
        // Hit an unexpected long pulse mid-byte; resync on it.
        i = findNextLong(pulses, i);
        continue;
      }
      cur.push(byte.value);
      i = byte.next;
    } else if (next === 'S') {
      // End-of-data marker: close the current copy.
      i += 2;
      finish();
    } else {
      i++; // lone long pulse
    }
  }
  finish();
  return segments;
}

interface ReadByte {
  value: number;
  next: number;
}

/** Read one tape byte (9 dipoles) starting at `i`; null if a long pulse intrudes. */
function readByte(pulses: PulseKind[], i: number): ReadByte | null {
  let value = 0;
  for (let b = 0; b < 9; b++) {
    const a = pulses[i];
    const c = pulses[i + 1];
    if (a === undefined || c === undefined) return null;
    if (a === 'L' || c === 'L') return null; // a marker started early — resync
    i += 2;
    if (b < 8) {
      const bit = a === 'M' && c === 'S' ? 1 : 0; // S,M → 0 ; M,S → 1
      value |= bit << b; // LSB first
    }
    // The ninth dipole is parity; the checksum is what we actually trust.
  }
  return { value, next: i };
}

function findNextLong(pulses: PulseKind[], i: number): number {
  while (i < pulses.length && pulses[i] !== 'L') i++;
  return i;
}

/**
 * Strip a leading countdown ($89..$81 or $09..$01) if present, then split the
 * trailing checksum byte and verify it. Returns the validated body, or null.
 */
function stripCountdownAndCheck(bytes: number[]): Uint8Array | null {
  let start = 0;
  if (
    startsWith(bytes, COUNTDOWN_FIRST) ||
    startsWith(bytes, COUNTDOWN_SECOND)
  ) {
    start = COUNTDOWN_FIRST.length;
  }
  const frame = bytes.slice(start);
  if (frame.length < 2) return null; // need at least one body byte + checksum
  const check = frame[frame.length - 1]!;
  const body = Uint8Array.from(frame.slice(0, -1));
  if (checksum(body) !== check) return null;
  return body;
}

function startsWith(bytes: number[], prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++)
    if (bytes[i] !== prefix[i]) return false;
  return true;
}

/**
 * Classify each pulse length as short / medium / long. The pilot tone makes the
 * short pulse the dominant lower cluster, so its centre (the median of the
 * lowest third) sets the reference and the thresholds scale from it.
 */
function classifyPulses(lengths: number[]): PulseKind[] {
  if (lengths.length === 0) return [];
  const sorted = [...lengths].sort((a, b) => a - b);
  const lowerThird = sorted.slice(
    0,
    Math.max(1, Math.floor(sorted.length / 3)),
  );
  const sRef = lowerThird[lowerThird.length >> 1]!; // ≈ a short pulse
  const sm = sRef * 1.25; // short|medium boundary (S≈1.0, M≈1.44)
  const ml = sRef * 1.67; // medium|long boundary (M≈1.44, L≈1.89)
  return lengths.map((d) => (d < sm ? 'S' : d < ml ? 'M' : 'L'));
}

/**
 * Recover pulse lengths (in samples) from the waveform: high-pass, then measure
 * the gap between consecutive upward zero-crossings — one per full square-wave
 * cycle. A Schmitt gate (±0.25 peak) only *confirms* each crossing belongs to a
 * real cycle rather than noise; the length itself is timed at the zero-crossing.
 *
 * Timing at the zero-crossing (not at the ±gate level) is what lets this survive
 * a speaker→microphone recording. A room echo adds a slowly-varying offset to
 * the signal; that offset shifts a fixed-level trigger by several samples —
 * enough to drag a pulse across C64's tight S/M/L boundaries (the on-tape ratios
 * are only 1.0 / 1.44 / 1.89) — but it barely moves the zero-crossing, where the
 * slope is steepest.
 */
function pulseLengths(samples: Float32Array, sampleRate: number): number[] {
  const hp = highPass(samples, sampleRate, 5);
  const peak = percentileAbs(hp, 0.99);
  if (peak < 1e-4) return [];
  const gate = peak * 0.25;

  const lengths: number[] = [];
  let state = -1; // hysteresis state: -1 low, +1 high
  let lastUpZero = -1; // most recent upward zero-crossing (candidate edge time)
  let prevRise = -1; // last committed cycle boundary (an upward zero-crossing)
  for (let i = 1; i < hp.length; i++) {
    if (hp[i - 1]! <= 0 && hp[i]! > 0) lastUpZero = i;
    if (state <= 0 && hp[i]! > gate) {
      // A real rising cycle: book its boundary at the preceding zero-crossing.
      const edge = lastUpZero >= 0 ? lastUpZero : i;
      if (prevRise >= 0) lengths.push(edge - prevRise);
      prevRise = edge;
      state = 1;
    } else if (state >= 0 && hp[i]! < -gate) {
      state = -1;
    }
  }
  return lengths;
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
