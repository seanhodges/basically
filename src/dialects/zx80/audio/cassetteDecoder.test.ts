import { describe, expect, it } from 'vitest';
import { encodeCassette } from './cassetteEncoder';
import { decodeCassette } from './cassetteDecoder';
import { tokenizeProgram } from '../tokenizer';
import { detokenizeProgram } from '../detokenizer';
import { buildOFile, parseOFile } from '../ofile';

const RATE = 44100;

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');

/** A small but representative .O image to round-trip through the tape codec. */
function sampleImage(src: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return buildOFile(bytes);
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

describe('decodeCassette (ZX80)', () => {
  it('round-trips the .O bytes through encode→decode', () => {
    const image = sampleImage('10 PRINT "HELLO"\n20 GOTO 10\n');
    const samples = encodeCassette(image, { sampleRate: RATE });
    const { data } = decodeCassette(samples, RATE);
    expect(Array.from(data)).toEqual(Array.from(image));
  });

  it('recovers the original source via parseOFile + detokenize', () => {
    const src = '10 LET A=5\n20 PRINT A\n30 GOTO 10\n';
    const image = sampleImage(src);
    const samples = encodeCassette(image, { sampleRate: RATE });
    const { data } = decodeCassette(samples, RATE);
    const source = detokenizeProgram(parseOFile(data).program);
    expect(normalize(source)).toBe(normalize(src));
  });

  const image = sampleImage('10 PRINT "ROBUST"\n20 GOTO 10\n');
  const clean = encodeCassette(image, { sampleRate: RATE });

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
        encodeCassette(image, {
          sampleRate: RATE,
          bitGapMicros: 2600,
          leaderSeconds: 4,
        }),
    ],
  ];

  for (const [label, make] of robustness) {
    it(`decodes despite ${label}`, () => {
      const { data } = decodeCassette(make(), RATE);
      expect(Array.from(data)).toEqual(Array.from(image));
    });
  }

  it('survives a sample-rate mismatch (decode at 48000)', () => {
    const { data } = decodeCassette(clean, 48000);
    expect(Array.from(data)).toEqual(Array.from(image));
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
