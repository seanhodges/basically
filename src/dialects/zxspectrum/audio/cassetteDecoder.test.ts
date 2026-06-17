import { describe, expect, it } from 'vitest';
import { encodeSpectrumTape } from './cassetteEncoder';
import { decodeCassette } from './cassetteDecoder';
import { tokenizeProgram } from '../tokenizer';
import { detokenizeProgram } from '../detokenizer';
import { tapBlocks, parseTap } from '../tapfile';

const RATE = 44100;

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');

function program(src: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return bytes;
}

function encode(src: string, name: string): Float32Array {
  return encodeSpectrumTape(tapBlocks(program(src), { name }), {
    sampleRate: RATE,
  });
}

/** Deterministic pseudo-random noise so the robustness tests don't flake. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addNoise(samples: Float32Array, amp: number, seed = 1): Float32Array {
  const rng = mulberry32(seed);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i]! + (rng() * 2 - 1) * amp;
  }
  return out;
}

function scale(samples: Float32Array, gain: number, dc = 0): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i]! * gain + dc;
  return out;
}

/** Linear-resample to simulate tape/clock speed drift. */
function resample(samples: Float32Array, factor: number): Float32Array {
  const n = Math.round(samples.length * factor);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i / factor;
    const lo = Math.floor(pos);
    const frac = pos - lo;
    const a = samples[lo] ?? 0;
    const b = samples[lo + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

describe('decodeCassette (Spectrum)', () => {
  it('round-trips the name and program through encode→decode', () => {
    const src = '10 PRINT "HELLO"\n20 GO TO 10\n';
    const samples = encode(src, 'GREETING');
    const { name, image } = decodeCassette(samples, RATE);
    expect(name).toBe('GREETING');
    expect(normalize(detokenizeProgram(parseTap(image).program))).toBe(
      normalize(src),
    );
  });

  const src = '10 LET A=5\n20 PRINT A\n30 GO TO 10\n';
  const expectedProgram = program(src);
  const clean = encode(src, 'TAPE');

  const robustness: [string, () => Float32Array][] = [
    ['additive noise', () => addNoise(clean, 0.12)],
    ['quiet (gain ×0.05)', () => scale(clean, 0.05)],
    ['loud (gain ×20)', () => scale(clean, 20)],
    ['DC offset', () => scale(clean, 1, 0.3)],
    ['noise + DC + low gain', () => addNoise(scale(clean, 0.3, 0.2), 0.04)],
    ['speed drift 0.85×', () => resample(clean, 0.85)],
    ['speed drift 1.15×', () => resample(clean, 1.15)],
    [
      'robust-mode encoding',
      () =>
        encodeSpectrumTape(tapBlocks(expectedProgram, { name: 'TAPE' }), {
          sampleRate: RATE,
          pilotScale: 2,
          blockPauseMs: 2000,
        }),
    ],
  ];

  for (const [label, make] of robustness) {
    it(`decodes despite ${label}`, () => {
      const { name, image } = decodeCassette(make(), RATE);
      expect(name).toBe('TAPE');
      expect(Array.from(parseTap(image).program)).toEqual(
        Array.from(expectedProgram),
      );
    });
  }

  it('survives a sample-rate mismatch (decode at 48000)', () => {
    const { name, image } = decodeCassette(clean, 48000);
    expect(name).toBe('TAPE');
    expect(Array.from(parseTap(image).program)).toEqual(
      Array.from(expectedProgram),
    );
  });

  it('rejects pure silence', () => {
    expect(() => decodeCassette(new Float32Array(RATE), RATE)).toThrow(
      /no cassette signal/i,
    );
  });

  it('rejects white noise', () => {
    const noise = addNoise(new Float32Array(RATE * 2), 0.5, 7);
    expect(() => decodeCassette(noise, RATE)).toThrow(/no cassette signal/i);
  });
});
