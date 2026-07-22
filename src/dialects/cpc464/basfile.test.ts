import { describe, expect, it } from 'vitest';
import { buildBasFile, parseBasFile } from './basfile';
import { tokenizeProgram } from './tokenizer';

const program = (): Uint8Array =>
  tokenizeProgram('10 PRINT "HELLO"\n20 GOTO 10\n').bytes;

describe('cpc464 AMSDOS .bas container', () => {
  it('round-trips a tokenized program through build/parse', () => {
    const p = program();
    const file = buildBasFile(p, 'hello');
    expect(file.length).toBe(128 + p.length);
    const parsed = parseBasFile(file);
    expect(Array.from(parsed.program)).toEqual(Array.from(p));
    expect(parsed.warnings).toEqual([]);
  });

  it('writes the 8.3 name, BASIC type and &170 load address', () => {
    const file = buildBasFile(program(), 'my prog!');
    const name = String.fromCharCode(...file.subarray(1, 12));
    expect(name).toBe('MYPROG  BAS');
    expect(file[18]).toBe(0x00); // unprotected BASIC
    expect(file[21]! | (file[22]! << 8)).toBe(0x0170);
  });

  it('validates the 128-byte header checksum', () => {
    const p = program();
    const file = buildBasFile(p, 'sum');
    const sum = file[67]! | (file[68]! << 8);
    let expected = 0;
    for (let i = 0; i < 67; i++) expected += file[i]!;
    expect(sum).toBe(expected & 0xffff);

    // A corrupted header fails the checksum and reads as raw data, exactly
    // as AMSDOS itself would treat it.
    const corrupt = Uint8Array.from(file);
    corrupt[5] = corrupt[5]! ^ 0xff;
    expect(parseBasFile(corrupt).program.length).toBe(corrupt.length);
  });

  it('accepts a headerless (raw tokenized) image with a warning-free parse', () => {
    const p = program();
    const parsed = parseBasFile(p);
    expect(parsed.program).toBe(p);
    expect(parsed.warnings).toEqual([]);
  });

  it('warns when the header declares more bytes than follow it', () => {
    const p = program();
    const file = buildBasFile(p, 'trunc').subarray(0, 128 + p.length - 4);
    const parsed = parseBasFile(file);
    expect(parsed.warnings.some((w) => w.includes('truncated'))).toBe(true);
    expect(parsed.program.length).toBe(p.length - 4);
  });

  it('warns on a non-BASIC file type but still yields the payload', () => {
    const p = program();
    const file = Uint8Array.from(buildBasFile(p, 'bin'));
    file[18] = 0x02; // binary
    // Re-fix the checksum for the modified type byte.
    let sum = 0;
    for (let i = 0; i < 67; i++) sum += file[i]!;
    file[67] = sum & 0xff;
    file[68] = (sum >> 8) & 0xff;
    const parsed = parseBasFile(file);
    expect(parsed.warnings.length).toBe(1);
    expect(Array.from(parsed.program)).toEqual(Array.from(p));
  });
});
