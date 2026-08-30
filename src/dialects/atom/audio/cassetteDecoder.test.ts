import { describe, expect, it } from 'vitest';
import { encodeAtomTape } from './cassetteEncoder';
import { decodeCassette } from './cassetteDecoder';
import { tokenizeProgram } from '../tokenizer';
import { detokenizeProgram } from '../detokenizer';
import { addNoise, scale, resample } from '../../audio/tapeSignal';

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

describe('decodeCassette (Atom)', () => {
  it('round-trips the name and program through encode→decode', () => {
    const src = '10 PRINT "HELLO"\n20 GOTO 10\n';
    const samples = encodeAtomTape(program(src), 'GREETING', {
      sampleRate: RATE,
    });
    const { name, data } = decodeCassette(samples, RATE);
    // Filenames are limited to 13 characters on the Atom.
    expect(name).toBe('GREETING');
    expect(normalize(detokenizeProgram(data))).toBe(normalize(src));
  });

  it('reassembles a program that spans several blocks', () => {
    // > 256 program bytes forces multiple blocks.
    const lines: string[] = [];
    for (let n = 1; n <= 30; n++) lines.push(`${n * 10} PRINT "LINE ${n}"`);
    const src = lines.join('\n') + '\n';
    const bytes = program(src);
    expect(bytes.length).toBeGreaterThan(256);
    const samples = encodeAtomTape(bytes, 'BIG', { sampleRate: RATE });
    const { name, data } = decodeCassette(samples, RATE);
    expect(name).toBe('BIG');
    expect(Array.from(data)).toEqual(Array.from(bytes));
  });

  const expectedProgram = program('10 A=5\n20 PRINT A\n30 GOTO 10\n');
  const clean = encodeAtomTape(expectedProgram, 'TAPE', { sampleRate: RATE });

  const robustness: [string, () => Float32Array][] = [
    ['additive noise', () => addNoise(clean, 0.1)],
    ['quiet (gain ×0.05)', () => scale(clean, 0.05)],
    ['loud (gain ×20)', () => scale(clean, 20)],
    ['DC offset', () => scale(clean, 1, 0.3)],
    ['noise + DC + low gain', () => addNoise(scale(clean, 0.3, 0.2), 0.03)],
    ['speed drift 0.9×', () => resample(clean, 0.9)],
    ['speed drift 1.1×', () => resample(clean, 1.1)],
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
