import { describe, expect, it } from 'vitest';
import { formatHexDump } from './hexdump';

describe('formatHexDump', () => {
  it('renders offset, hex bytes and ASCII gutter', () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0xff]);
    expect(formatHexDump(bytes)).toBe(
      '0000  48 65 6c 6c 6f 00 ff                             |Hello..|',
    );
  });

  it('splits rows every 16 bytes', () => {
    const bytes = new Uint8Array(17).fill(0x41);
    const lines = formatHexDump(bytes).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^0000 {2}(41 ){15}41 {2}\|A{16}\|$/);
    expect(lines[1]).toMatch(/^0010 {2}41 +\|A\|$/);
  });

  it('renders nothing for an empty payload', () => {
    expect(formatHexDump(new Uint8Array(0))).toBe('');
  });

  it('truncates at maxBytes with a note', () => {
    const bytes = new Uint8Array(40);
    const lines = formatHexDump(bytes, 32).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('… showing first 32 of 40 bytes');
  });
});
