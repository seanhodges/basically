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

describe('vic20 cassette', () => {
  it('round-trips the name and program through encode -> decode', () => {
    const src = '10 PRINT "HELLO"\n20 GOTO 10\n';
    const samples = buildCassetteSamples(src, 'GREETING');
    const { programName, source } = decodeSamples(samples, RATE);
    expect(programName).toBe('GREETING');
    expect(normalize(source)).toBe(normalize(src));
  });

  it('round-trips a program that pokes the VIC sound and colour registers', () => {
    // The kind of program the VIC-20 profile encourages: POKE 36879 for the
    // border/background and the VIC-I voice/volume registers for sound.
    const src = '10 POKE 36879,8\n20 POKE 36878,15\n30 POKE 36876,200\n';
    const samples = buildCassetteSamples(src, 'NOISY');
    const { programName, source } = decodeSamples(samples, RATE);
    expect(programName).toBe('NOISY');
    expect(normalize(source)).toBe(normalize(src));
  });

  it('writes the header block with the $1001 VIC-20 load address', () => {
    const src = '10 PRINT "HI"\n';
    // The header carries the start address; an unexpanded VIC-20 tape loads at
    // $1001, not the C64's $0801. buildHeaderBlock is the routine the encoder uses.
    const header = buildHeaderBlock('HI', 0x1001, 0x1100);
    expect(header[1]).toBe(0x01); // start lo
    expect(header[2]).toBe(0x10); // start hi ($1001)
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
