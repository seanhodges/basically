import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { buildBasFile } from './basfile';
import { buildCdt } from './cdt';
import { importCpcImage } from './importCpc';

const SRC = '10 PRINT "HELLO"\n20 GOTO 10\n';
const program = (s = SRC): Uint8Array => tokenizeProgram(s).bytes;

describe('cpc464 import sniffing', () => {
  it('detokenizes a raw tokenized image', () => {
    const { source, warnings } = importCpcImage(program());
    expect(source).toContain('PRINT "HELLO"');
    expect(source).toContain('GOTO 10');
    expect(warnings).toEqual([]);
  });

  it('unwraps an AMSDOS-headered .bas', () => {
    const file = buildBasFile(program(), 'hello');
    const { source } = importCpcImage(file);
    expect(source).toContain('PRINT "HELLO"');
  });

  it('unwraps a .cdt tape image', () => {
    const { source } = importCpcImage(buildCdt(program(), 'hello'));
    expect(source).toContain('PRINT "HELLO"');
  });

  it('loads a plain-text .bas listing as source verbatim', () => {
    const text = new TextEncoder().encode(SRC);
    const { source, warnings } = importCpcImage(text);
    expect(source).toBe(SRC);
    expect(warnings).toEqual([]);
  });

  it('normalises CRLF line endings in a text listing', () => {
    const text = new TextEncoder().encode('10 PRINT "HI"\r\n20 END\r\n');
    const { source } = importCpcImage(text);
    expect(source).toBe('10 PRINT "HI"\n20 END\n');
  });
});
