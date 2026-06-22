/**
 * TRS-80 500-baud cassette encoding.
 *
 * The TRS-80 records a stream of brief pulses on tape. Every bit cell opens
 * with a *clock* pulse; a 1 bit additionally fires a *data* pulse at the middle
 * of the cell, a 0 bit does not. So the spacing between successive pulses is
 * what carries the data: a 1 is two half-cell gaps (clock→data, data→next
 * clock), a 0 is one full-cell gap (clock→next clock). Bytes are written
 * MSB-first. A block is a long leader of 0x00 bytes (all clock pulses, which
 * lets the reader lock on), the 0xA5 sync byte, the 0xD3 0xD3 0xD3 BASIC marker,
 * a one-character filename and the tokenized program — see {@link buildCasImage}.
 *
 * Each pulse is rendered as one brief positive rectangle, the rest of the cell
 * silence — so every pulse has a single clean rising edge the decoder locks
 * onto. The round-trip through {@link decodeCassette} reproduces the program
 * bytes.
 */
import { tokenizeProgram } from '../tokenizer';
import { buildCasImage } from '../casfile';

export const CASSETTE_SAMPLE_RATE = 44100;

/** One bit cell at 500 baud, in microseconds. */
export const BIT_CELL_MICROS = 2000;
/** Clock→data spacing inside a 1 bit (half a cell). */
const HALF_CELL_MICROS = BIT_CELL_MICROS / 2;
/** Width of one pulse rectangle (well under a half-cell so pulses stay distinct). */
const PULSE_MICROS = 150;

export interface Trs80TapeOptions {
  sampleRate?: number;
  amplitude?: number;
}

/** Encode source to cassette samples — the dialect's `audio.buildSamples`. */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  const { program, errors } = tokenizeProgram(source);
  if (errors.length > 0) {
    throw new Error(
      `Program has ${errors.length} error(s) — fix them before building`,
    );
  }
  // A bare 0x0000 end link means the program is empty.
  if (program.length <= 2) throw new Error('Program is empty');
  // A longer leader gives a speaker→mic recording more time to lock on.
  const image = buildCasImage(program, programName, robust ? 256 : 128);
  return bytesToCassetteSamples(image, { sampleRate: CASSETTE_SAMPLE_RATE });
}

/**
 * Render cassette bytes to a square-wave Float32Array using the Model I bit
 * scheme. Builds the list of pulse times (microseconds) first, then paints each
 * pulse, so rounding never accumulates drift across the block.
 */
export function bytesToCassetteSamples(
  bytes: Uint8Array,
  opts: Trs80TapeOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? CASSETTE_SAMPLE_RATE;
  const amplitude = opts.amplitude ?? 0.85;

  const pulses: number[] = [];
  let t = 0;
  pulses.push(t); // the very first clock pulse
  for (const byte of bytes) {
    for (let b = 7; b >= 0; b--) {
      // MSB first
      if ((byte >> b) & 1) {
        t += HALF_CELL_MICROS;
        pulses.push(t); // data pulse
        t += HALF_CELL_MICROS;
        pulses.push(t); // next clock
      } else {
        t += BIT_CELL_MICROS;
        pulses.push(t); // next clock
      }
    }
  }

  const samplesPerMicro = sampleRate / 1e6;
  const totalMicros = t + BIT_CELL_MICROS; // trailing silence
  const out = new Float32Array(Math.ceil(totalMicros * samplesPerMicro) + 1);
  for (const start of pulses) {
    const s0 = Math.round(start * samplesPerMicro);
    const s1 = Math.round((start + PULSE_MICROS) * samplesPerMicro);
    out.fill(amplitude, s0, s1);
  }
  return out;
}
