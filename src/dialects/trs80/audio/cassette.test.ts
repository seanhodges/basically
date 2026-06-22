import { describe, expect, it } from 'vitest';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  bytesToCassetteSamples,
} from './cassetteEncoder';
import { decodeCassette } from './cassetteDecoder';
import { tokenizeProgram } from '../tokenizer';
import { detokenizeProgram } from '../detokenizer';
import { buildCasImage } from '../casfile';

const SOURCE = '10 FOR I=1 TO 10\n20 PRINT I;"SQUARED IS";I*I\n30 NEXT I\n';

describe('trs80 cassette audio', () => {
  it('round-trips a program through encode → decode', () => {
    const samples = buildCassetteSamples(SOURCE, 'SQUARES');
    const { programName, data } = decodeCassette(samples, CASSETTE_SAMPLE_RATE);

    const { program } = tokenizeProgram(SOURCE);
    expect(programName).toBe('S');
    expect(Array.from(data)).toEqual(Array.from(program));
    expect(detokenizeProgram(data)).toBe(SOURCE);
  });

  it('decodes the robust (longer-leader) encoding too', () => {
    const samples = buildCassetteSamples(SOURCE, 'A', true);
    const { data } = decodeCassette(samples, CASSETTE_SAMPLE_RATE);
    expect(detokenizeProgram(data)).toBe(SOURCE);
  });

  it('survives a quieter, noisier recording', () => {
    const { program } = tokenizeProgram(SOURCE);
    const clean = bytesToCassetteSamples(buildCasImage(program, 'N', 128), {
      sampleRate: CASSETTE_SAMPLE_RATE,
      amplitude: 0.3,
    });
    // Add a slow baseline drift and a touch of white noise.
    const dirty = Float32Array.from(clean, (v, i) => {
      const drift = 0.15 * Math.sin((2 * Math.PI * i) / clean.length);
      const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      return v + drift + 0.02 * noise;
    });
    const { data } = decodeCassette(dirty, CASSETTE_SAMPLE_RATE);
    expect(detokenizeProgram(data)).toBe(SOURCE);
  });

  it('throws on silence', () => {
    expect(() =>
      decodeCassette(new Float32Array(4096), CASSETTE_SAMPLE_RATE),
    ).toThrow();
  });

  it('rejects an empty program at encode time', () => {
    expect(() => buildCassetteSamples('', 'A')).toThrow(/empty/);
  });
});
