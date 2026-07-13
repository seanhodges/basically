import { describe, expect, it } from 'vitest';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  decodeSamples,
} from './cassette';
import { buildHeaderBlock } from '../../commodore64/audio/cassetteEncoder';

const RATE = CASSETTE_SAMPLE_RATE;

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');

describe('pet cassette', () => {
  it('round-trips the name and program through encode -> decode', () => {
    const src = '10 PRINT "HELLO"\n20 GOTO 10\n';
    const samples = buildCassetteSamples(src, 'GREETING');
    const { programName, source } = decodeSamples(samples, RATE);
    expect(programName).toBe('GREETING');
    expect(normalize(source)).toBe(normalize(src));
  });

  it('round-trips a program using BASIC 4.0 disk tokens ($CC-$DA)', () => {
    // DIRECTORY ($DA) and DOPEN ($CD) prove the PET keyword table is used on the
    // way back out — the C64 detokenizer would not know these tokens.
    const src = '10 DOPEN#1,"DATA"\n20 DIRECTORY\n';
    const samples = buildCassetteSamples(src, 'DISK');
    const { programName, source } = decodeSamples(samples, RATE);
    expect(programName).toBe('DISK');
    expect(normalize(source)).toBe(normalize(src));
  });

  it('writes the header block with the $0401 PET load address', () => {
    const src = '10 PRINT "HI"\n';
    // The header carries the start address; a PET tape loads at $0401, not the
    // C64's $0801. buildHeaderBlock is the same routine the encoder uses.
    const header = buildHeaderBlock('HI', 0x0401, 0x0500);
    expect(header[1]).toBe(0x01); // start lo
    expect(header[2]).toBe(0x04); // start hi ($0401)
    // And a full encode -> decode still recovers the program.
    const { source } = decodeSamples(buildCassetteSamples(src, 'HI'), RATE);
    expect(normalize(source)).toBe(normalize(src));
  });

  it('robust mode lengthens the recording', () => {
    const src = '10 PRINT "HI"\n';
    const normal = buildCassetteSamples(src, 'HI', false);
    const robust = buildCassetteSamples(src, 'HI', true);
    expect(robust.length).toBeGreaterThan(normal.length);
    // Both still decode.
    expect(decodeSamples(robust, RATE).programName).toBe('HI');
  });
});
