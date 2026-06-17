import { describe, expect, it } from 'vitest';
import { encodeBbcTape } from './cassetteEncoder';
import { decodeCassette } from './cassetteDecoder';
import { tokenizeProgram } from '../tokenizer';
import { detokenizeProgram } from '../detokenizer';

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

describe('decodeCassette (BBC)', () => {
  it('round-trips the name and program through encode→decode', () => {
    const src = '10 PRINT "HELLO"\n20 GOTO 10\n';
    const samples = encodeBbcTape(program(src), 'GREETING', {
      sampleRate: RATE,
    });
    const { name, data } = decodeCassette(samples, RATE);
    expect(name).toBe('GREETING');
    expect(normalize(detokenizeProgram(data))).toBe(normalize(src));
  });

  it('reassembles a program that spans several CFS blocks', () => {
    // > 256 program bytes forces multiple blocks.
    const lines: string[] = [];
    for (let n = 1; n <= 40; n++) lines.push(`${n * 10} PRINT "LINE ${n}"`);
    const src = lines.join('\n') + '\n';
    const bytes = program(src);
    expect(bytes.length).toBeGreaterThan(256);
    const samples = encodeBbcTape(bytes, 'BIG', { sampleRate: RATE });
    const { name, data } = decodeCassette(samples, RATE);
    expect(name).toBe('BIG');
    expect(Array.from(data)).toEqual(Array.from(bytes));
  });

  const expectedProgram = program('10 LET A=5\n20 PRINT A\n30 GOTO 10\n');
  const clean = encodeBbcTape(expectedProgram, 'TAPE', { sampleRate: RATE });

  const robustness: [string, () => Float32Array][] = [
    ['additive noise', () => addNoise(clean, 0.1)],
    ['quiet (gain ×0.05)', () => scale(clean, 0.05)],
    ['loud (gain ×20)', () => scale(clean, 20)],
    ['DC offset', () => scale(clean, 1, 0.3)],
    ['noise + DC + low gain', () => addNoise(scale(clean, 0.3, 0.2), 0.03)],
    ['speed drift 0.9×', () => resample(clean, 0.9)],
    ['speed drift 1.1×', () => resample(clean, 1.1)],
    [
      'robust-mode encoding',
      () =>
        encodeBbcTape(expectedProgram, 'TAPE', {
          sampleRate: RATE,
          leaderMs: 4000,
          interBlockMs: 2000,
        }),
    ],
  ];

  for (const [label, make] of robustness) {
    it(`decodes despite ${label}`, () => {
      const { name, data } = decodeCassette(make(), RATE);
      expect(name).toBe('TAPE');
      expect(Array.from(data)).toEqual(Array.from(expectedProgram));
    });
  }

  it('survives a sample-rate mismatch (decode at 48000)', () => {
    const { name, data } = decodeCassette(clean, 48000);
    expect(name).toBe('TAPE');
    expect(Array.from(data)).toEqual(Array.from(expectedProgram));
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
