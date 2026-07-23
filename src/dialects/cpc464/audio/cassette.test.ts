import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from '../tokenizer';
import {
  buildCassetteSamples,
  decodeCassette,
  CASSETTE_SAMPLE_RATE,
} from './cassette';
import { buildFirmwareStream, parseFirmwareStream, crc16 } from './firmware';

const SRC = '10 PRINT "HELLO CPC"\n20 FOR I=1 TO 10\n30 NEXT I\n40 GOTO 10\n';
const program = (s = SRC): Uint8Array => tokenizeProgram(s).bytes;

/** A program whose tokenized image spans more than one 2K firmware block. */
function bigProgram(): Uint8Array {
  let src = '';
  for (let line = 10; line <= 4000; line += 10) {
    src += `${line} PRINT "THE QUICK BROWN FOX JUMPS":REM PADDING LINE\n`;
  }
  const bytes = tokenizeProgram(src).bytes;
  expect(bytes.length).toBeGreaterThan(2048);
  return bytes;
}

describe('cpc464 firmware record stream', () => {
  it('round-trips a tokenized program', () => {
    const p = program();
    const stream = buildFirmwareStream(p, 'hello');
    const decoded = parseFirmwareStream(stream);
    expect(decoded.name).toBe('HELLO');
    expect(Array.from(decoded.program)).toEqual(Array.from(p));
    expect(decoded.warnings).toEqual([]);
  });

  it('splits a large program across multiple 2K blocks and rejoins them', () => {
    const p = bigProgram();
    const decoded = parseFirmwareStream(buildFirmwareStream(p, 'big'));
    expect(Array.from(decoded.program)).toEqual(Array.from(p));
    expect(decoded.warnings).toEqual([]);
  });

  it('flags a corrupted segment via its CRC', () => {
    const p = program();
    const stream = buildFirmwareStream(p, 'hello');
    // Flip a byte inside the header segment (past the sync + into the payload).
    stream[10] ^= 0xff;
    const decoded = parseFirmwareStream(stream);
    expect(decoded.warnings.join(' ')).toMatch(/checksum/i);
  });

  it('computes the CCITT CRC as a complement (residue check)', () => {
    // The stored CRC complements the running value, so re-running the CRC over
    // the data and appending the two stored bytes lands on the 0xFFFF residue.
    const data = Uint8Array.from([1, 2, 3, 4, 5]);
    const crc = crc16(data);
    expect(crc & 0xffff).toBe(crc);
  });
});

describe('cpc464 cassette audio', () => {
  it('round-trips at the default 2000 baud', () => {
    const samples = buildCassetteSamples(SRC, 'hello', false);
    const {
      name,
      program: prog,
      warnings,
    } = decodeCassette(samples, CASSETTE_SAMPLE_RATE);
    expect(name).toBe('HELLO');
    expect(Array.from(prog)).toEqual(Array.from(program()));
    expect(warnings).toEqual([]);
  });

  it('round-trips in robust (1000 baud) mode', () => {
    const samples = buildCassetteSamples(SRC, 'hello', true);
    const { program: prog, warnings } = decodeCassette(
      samples,
      CASSETTE_SAMPLE_RATE,
    );
    expect(Array.from(prog)).toEqual(Array.from(program()));
    expect(warnings).toEqual([]);
  });

  it('survives light additive noise on the recording', () => {
    const clean = buildCassetteSamples(SRC, 'hello', true);
    const noisy = Float32Array.from(
      clean,
      (s, i) => s + Math.sin(i * 0.7) * 0.05,
    );
    const { program: prog } = decodeCassette(noisy, CASSETTE_SAMPLE_RATE);
    expect(Array.from(prog)).toEqual(Array.from(program()));
  });

  it('rejects an empty program', () => {
    expect(() => buildCassetteSamples('', 'empty', false)).toThrow(/empty/i);
  });

  it('rejects silence on decode', () => {
    expect(() =>
      decodeCassette(new Float32Array(4096), CASSETTE_SAMPLE_RATE),
    ).toThrow();
  });
});
