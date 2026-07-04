import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64 codec', () => {
  it('round-trips all byte values', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('handles the empty payload', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });

  it.each([
    [1, 'AA=='],
    [2, 'AAA='],
    [3, 'AAAA'],
  ])('pads a %i-byte payload as %s', (len, encoded) => {
    expect(bytesToBase64(new Uint8Array(len))).toBe(encoded);
    expect(base64ToBytes(encoded)).toEqual(new Uint8Array(len));
  });

  it('matches the canonical encoding of known text', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(bytesToBase64(bytes)).toBe('SGVsbG8=');
    expect(base64ToBytes('SGVsbG8=')).toEqual(bytes);
  });

  it('rejects malformed input', () => {
    expect(() => base64ToBytes('AA$A')).toThrow();
  });
});
