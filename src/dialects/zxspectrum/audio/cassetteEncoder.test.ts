import { describe, it, expect } from 'vitest';
import { encodeSpectrumTape } from './cassetteEncoder';
import { tapBlocks } from '../tapfile';

const SAMPLE_RATE = 44100;
const TSTATE_MICROS = 1e6 / 3_500_000;

/**
 * Recover the tape blocks from a generated waveform by measuring pulse widths.
 * The signal is a square wave (each pulse a run of constant sign) with silent
 * gaps (zero) between blocks, so a run of one sign is exactly one pulse.
 */
function decode(samples: Float32Array): Uint8Array[] {
  const samplesToTstates = (n: number) =>
    ((n / SAMPLE_RATE) * 1e6) / TSTATE_MICROS;
  const sign = (s: number) => (s > 0.01 ? 1 : s < -0.01 ? -1 : 0);

  // Collapse the signal into runs of constant sign; drop silence (sign 0).
  let i = 0;
  const runs: { t: number; gapBefore: boolean }[] = [];
  let gapBefore = true;
  while (i < samples.length) {
    const s = sign(samples[i]!);
    if (s === 0) {
      gapBefore = true;
      i++;
      continue;
    }
    let j = i;
    while (j < samples.length && sign(samples[j]!) === s) j++;
    runs.push({ t: samplesToTstates(j - i), gapBefore });
    gapBefore = false;
    i = j;
  }

  const near = (t: number, target: number) =>
    Math.abs(t - target) / target < 0.2;

  const blocks: Uint8Array[] = [];
  let k = 0;
  while (k < runs.length) {
    // A block starts after a gap with a pilot tone (~2168 T pulses).
    if (!near(runs[k]!.t, 2168)) {
      k++;
      continue;
    }
    while (k < runs.length && near(runs[k]!.t, 2168)) k++;
    // Two sync pulses (667, 735).
    k += 2;
    // Data: pulses in pairs, each pair one bit (855 = 0, 1710 = 1), MSB first.
    const bits: number[] = [];
    while (k + 1 < runs.length && !runs[k]!.gapBefore) {
      const t = runs[k]!.t;
      bits.push(t > (855 + 1710) / 2 ? 1 : 0);
      k += 2;
    }
    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let b = 0; b < bytes.length; b++) {
      let v = 0;
      for (let bit = 0; bit < 8; bit++) v = (v << 1) | bits[b * 8 + bit]!;
      bytes[b] = v;
    }
    blocks.push(bytes);
  }
  return blocks;
}

describe('encodeSpectrumTape', () => {
  // A trivial tokenized program: line 10 (0x00 0x0a), 2-byte length, body.
  const program = Uint8Array.from([0x00, 0x0a, 0x02, 0x00, 0xf9, 0x0d]);

  it('round-trips both tape blocks through the waveform', () => {
    const blocks = tapBlocks(program, { name: 'test' });
    const samples = encodeSpectrumTape(blocks, { sampleRate: SAMPLE_RATE });
    const decoded = decode(samples);

    expect(decoded).toHaveLength(2);
    expect(Array.from(decoded[0]!)).toEqual(Array.from(blocks[0]!.bytes));
    expect(Array.from(decoded[1]!)).toEqual(Array.from(blocks[1]!.bytes));
  });

  it('gives the header block a longer pilot tone than the data block', () => {
    const blocks = tapBlocks(program, { name: 'test' });
    const headerOnly = encodeSpectrumTape([blocks[0]!], {
      sampleRate: SAMPLE_RATE,
      blockPauseMs: 0,
      leadingSilenceMs: 0,
    });
    const dataOnly = encodeSpectrumTape([blocks[1]!], {
      sampleRate: SAMPLE_RATE,
      blockPauseMs: 0,
      leadingSilenceMs: 0,
    });
    // Header pilot is 8063 pulses vs 3223 for data, so for the same tiny
    // payload the header recording is the longer of the two.
    expect(headerOnly.length).toBeGreaterThan(dataOnly.length);
  });

  it('robust mode lengthens the recording', () => {
    const blocks = tapBlocks(program, { name: 'test' });
    const normal = encodeSpectrumTape(blocks, { sampleRate: SAMPLE_RATE });
    const robust = encodeSpectrumTape(blocks, {
      sampleRate: SAMPLE_RATE,
      pilotScale: 2,
      blockPauseMs: 2000,
    });
    expect(robust.length).toBeGreaterThan(normal.length);
  });
});
