import { describe, expect, it } from 'vitest';
import { samplesToWav } from './wav';

describe('samplesToWav', () => {
  it('writes a valid RIFF header', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = samplesToWav(samples, 44100);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);

    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(String.fromCharCode(...bytes.slice(12, 16))).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16); // bits
    expect(String.fromCharCode(...bytes.slice(36, 40))).toBe('data');
    expect(view.getUint32(40, true)).toBe(10); // 5 samples * 2 bytes
    expect(bytes.length).toBe(44 + 10);
    // Full-scale sample
    expect(view.getInt16(44 + 6, true)).toBe(0x7fff);
  });
});
