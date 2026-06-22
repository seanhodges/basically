import { describe, expect, it } from 'vitest';
import { buildCassetteSamples, CASSETTE_SAMPLE_RATE } from './targets';
import { decodeCassette } from '../zxspectrum/audio/cassetteDecoder';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { parseTap } from './tapfile';

const RATE = CASSETTE_SAMPLE_RATE;

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');

describe('zxspectrum128 cassette round-trip', () => {
  // PLAY (0xA4) is a 128-only token the 48K tokenizer rejects — its presence
  // here proves the audio path is driven by the 128 tokenizer/detokenizer.
  const src = '10 PLAY "C"\n20 PRINT "HELLO"\n30 GO TO 20\n';

  it('encodes and decodes a PLAY program through the cassette path', () => {
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);

    const samples = buildCassetteSamples(src, 'TUNE');
    const { name, image } = decodeCassette(samples, RATE);

    expect(name).toBe('TUNE');
    expect(Array.from(parseTap(image).program)).toEqual(Array.from(bytes));
    expect(normalize(detokenizeProgram(parseTap(image).program))).toBe(
      normalize(src),
    );
  });

  it('refuses to build a program with tokenizer errors', () => {
    // A line must start with a command keyword; "x=5" is not one.
    expect(() => buildCassetteSamples('10 x=5\n', 'BAD')).toThrow(/error/i);
  });

  it('refuses to build an empty program', () => {
    expect(() => buildCassetteSamples('', 'EMPTY')).toThrow(/empty/i);
  });
});
