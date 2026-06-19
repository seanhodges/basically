import { describe, it, expect } from 'vitest';
import {
  buildHeaderBlock,
  checksum,
  encodeC64Tape,
  nameBytes,
  PULSE_SHORT_MICROS,
  PULSE_MEDIUM_MICROS,
  PULSE_LONG_MICROS,
} from './cassetteEncoder';

const SAMPLE_RATE = 44100;

/**
 * Recover the pulse-kind stream from the waveform the way the decoder does, but
 * with absolute-timing classification so the test is independent of the
 * decoder's adaptive thresholds. Each pulse is one full square-wave cycle, so we
 * measure the gap between rising edges and bucket it by the known periods.
 */
function pulses(samples: Float32Array): ('S' | 'M' | 'L')[] {
  const micros = (n: number) => (n / SAMPLE_RATE) * 1e6;
  const out: ('S' | 'M' | 'L')[] = [];
  let state = -1;
  let lastRise = -1;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]!;
    if (state <= 0 && v > 0.1) {
      if (lastRise >= 0) {
        const d = micros(i - lastRise);
        out.push(d < 440 ? 'S' : d < 600 ? 'M' : 'L');
      }
      lastRise = i;
      state = 1;
    } else if (state >= 0 && v < -0.1) {
      state = -1;
    }
  }
  return out;
}

describe('checksum', () => {
  it('is the XOR of the bytes', () => {
    expect(checksum(Uint8Array.from([0x12, 0x34, 0x56]))).toBe(
      0x12 ^ 0x34 ^ 0x56,
    );
    expect(checksum(new Uint8Array(0))).toBe(0);
  });
});

describe('nameBytes', () => {
  it('upper-cases, strips punctuation and pads to 16 spaces', () => {
    const nb = nameBytes('Hi!');
    expect(nb).toHaveLength(16);
    expect(String.fromCharCode(...nb)).toBe('HI              ');
  });

  it('falls back to PROGRAM for an empty name', () => {
    expect(String.fromCharCode(...nameBytes('')).trim()).toBe('PROGRAM');
  });
});

describe('buildHeaderBlock', () => {
  it('lays out file type, addresses and filename', () => {
    const header = buildHeaderBlock('TEST', 0x0801, 0x0900);
    expect(header).toHaveLength(192);
    expect(header[0]).toBe(0x01); // relocatable BASIC program
    expect(header[1]).toBe(0x01); // start lo
    expect(header[2]).toBe(0x08); // start hi
    expect(header[3]).toBe(0x00); // end lo
    expect(header[4]).toBe(0x09); // end hi
    expect(String.fromCharCode(...header.subarray(5, 9))).toBe('TEST');
  });
});

describe('encodeC64Tape', () => {
  const header = buildHeaderBlock('P', 0x0801, 0x0803);
  const program = Uint8Array.from([0xaa]);

  it('encodes a 0 bit as S,M and a 1 bit as M,S after the L,M marker', () => {
    // One byte 0xAA = 1010 1010 (LSB first: 0,1,0,1,0,1,0,1) + odd parity.
    const samples = encodeC64Tape(new Uint8Array(0), Uint8Array.from([0xaa]), {
      sampleRate: SAMPLE_RATE,
      leaderPulses: 0,
      interCopyPulses: 0,
      trailerPulses: 0,
    });
    const p = pulses(samples);
    // The empty header block still emits two copies of (9 countdown + 1
    // checksum = 10 bytes) each followed by an end-of-data marker (2 pulses):
    // 2 × (10 × 20 + 2) = 404 pulses. Then the program block's first copy opens
    // with its 9 countdown bytes (180 pulses), so the 0xAA byte starts at 584.
    const byteStart = 2 * (10 * 20 + 2) + 9 * 20; // 584
    expect(p[byteStart]).toBe('L'); // marker
    expect(p[byteStart + 1]).toBe('M');
    // bit0 = 0 → S,M ; bit1 = 1 → M,S
    expect(p[byteStart + 2]).toBe('S');
    expect(p[byteStart + 3]).toBe('M');
    expect(p[byteStart + 4]).toBe('M');
    expect(p[byteStart + 5]).toBe('S');
  });

  it('uses pulse periods of ~360/520/680µs', () => {
    const samples = encodeC64Tape(header, program, {
      sampleRate: SAMPLE_RATE,
      leaderPulses: 4,
      interCopyPulses: 0,
      trailerPulses: 0,
    });
    // Leader is short pulses; measure the first full pulse period.
    const micros = (n: number) => (n / SAMPLE_RATE) * 1e6;
    let firstRise = -1;
    let secondRise = -1;
    let state = -1;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i]!;
      if (state <= 0 && v > 0.1) {
        if (firstRise < 0) firstRise = i;
        else {
          secondRise = i;
          break;
        }
        state = 1;
      } else if (state >= 0 && v < -0.1) {
        state = -1;
      }
    }
    expect(micros(secondRise - firstRise)).toBeCloseTo(PULSE_SHORT_MICROS, -1);
    expect(PULSE_MEDIUM_MICROS).toBeGreaterThan(PULSE_SHORT_MICROS);
    expect(PULSE_LONG_MICROS).toBeGreaterThan(PULSE_MEDIUM_MICROS);
  });

  it('emits an odd-parity bit so data + parity has an odd number of 1s', () => {
    // 0x03 = two set bits (even) → parity bit must be 1 (M,S).
    const samples = encodeC64Tape(new Uint8Array(0), Uint8Array.from([0x03]), {
      sampleRate: SAMPLE_RATE,
      leaderPulses: 0,
      interCopyPulses: 0,
      trailerPulses: 0,
    });
    const p = pulses(samples);
    const byteStart = 2 * (10 * 20 + 2) + 9 * 20; // 584 (see the bit test)
    const parity = byteStart + 2 + 8 * 2; // marker + 8 data dipoles
    expect(p[parity]).toBe('M'); // M,S = 1
    expect(p[parity + 1]).toBe('S');
  });

  it('robust mode (longer leader) lengthens the recording', () => {
    const normal = encodeC64Tape(header, program, {
      sampleRate: SAMPLE_RATE,
      leaderPulses: 1200,
    });
    const robust = encodeC64Tape(header, program, {
      sampleRate: SAMPLE_RATE,
      leaderPulses: 2400,
    });
    expect(robust.length).toBeGreaterThan(normal.length);
  });
});
