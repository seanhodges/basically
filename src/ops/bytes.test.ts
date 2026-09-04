import { describe, expect, it } from 'vitest';
import { decodeBytes, encodeBytes } from './bytes';

describe('bytes as text', () => {
  it('round-trips every byte value, and a buffer larger than one slice', () => {
    const bytes = new Uint8Array(100_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    expect(decodeBytes(encodeBytes(bytes))).toEqual(bytes);
    expect(encodeBytes(new Uint8Array(0))).toBe('');
  });

  it('is base64, as any reader of the JSON expects', () => {
    expect(encodeBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe(
      'iVBORw==',
    );
  });
});
