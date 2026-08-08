import { describe, expect, it } from 'vitest';
import {
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
  spectrum128BuildTargets,
} from './targets';
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

describe('zxspectrum128 build targets', () => {
  it('declare both tape formats carry memory blocks', () => {
    // The Transfer dialog offers the auto-loader, and skips the
    // blocks-will-be-dropped notice, off this flag.
    expect(
      spectrum128BuildTargets
        .filter((t) => t.supportsBlocks)
        .map((t) => t.id)
        .sort(),
    ).toEqual(['tap-file', 'wav']);
  });
});

describe('zxspectrum128 cassette round-trip', () => {
  // PLAY (0xA4) is a 128-only token the 48K tokenizer rejects - its presence
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
    // Only fatal errors block the build: an unterminated string leaves a line
    // that cannot be framed at all. A statement-shape squiggle ("10 x=5")
    // deliberately does not - the machine would store that line and object at
    // RUN, so it must still reach a tape.
    expect(() => buildCassetteSamples('10 PRINT "hi\n', 'BAD')).toThrow(
      /error/i,
    );
    expect(() => buildCassetteSamples('10 x=5\n', 'LINT')).not.toThrow();
  });

  it('refuses to build an empty program', () => {
    expect(() => buildCassetteSamples('', 'EMPTY')).toThrow(/empty/i);
  });
});
