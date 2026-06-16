import { describe, it, expect } from 'vitest';
import {
  encodeBbcTape,
  buildCfsBlocks,
  buildCfsBlock,
  crc16,
} from './cassetteEncoder';

const SAMPLE_RATE = 44100;

/**
 * Decode the FSK waveform back to bytes. The signal is a square wave; each
 * half-cycle is a run of constant sign. A 2400 Hz half is ~208µs, a 1200 Hz
 * half ~417µs. A `0` bit is one 1200 Hz cycle (2 slow halves), a `1` bit is two
 * 2400 Hz cycles (4 fast halves). Bytes are framed 8N1; the carrier between
 * frames is continuous fast halves. We resync on each slow half (a start bit).
 */
function decode(samples: Float32Array): Uint8Array {
  const micros = (n: number) => (n / SAMPLE_RATE) * 1e6;
  const sign = (s: number) => (s > 0.01 ? 1 : s < -0.01 ? -1 : 0);

  // Collapse into half-cycles, each tagged fast (2400 Hz) or slow (1200 Hz).
  const halves: boolean[] = []; // true = fast
  let i = 0;
  while (i < samples.length) {
    const s = sign(samples[i]!);
    if (s === 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < samples.length && sign(samples[j]!) === s) j++;
    halves.push(micros(j - i) < 312); // midpoint of 208 and 417µs
    i = j;
  }

  const bytes: number[] = [];
  let k = 0;
  // readBit consumes 2 slow halves (→0) or 4 fast halves (→1).
  const readBit = (): number | null => {
    if (k >= halves.length) return null;
    if (!halves[k]) {
      k += 2; // slow → '0'
      return 0;
    }
    k += 4; // fast → '1'
    return 1;
  };
  while (k < halves.length) {
    if (halves[k]) {
      k++; // skip carrier / stop bits until a start bit (slow half)
      continue;
    }
    const start = readBit(); // start bit, must be 0
    if (start !== 0) continue;
    let v = 0;
    for (let b = 0; b < 8; b++) {
      const bit = readBit();
      if (bit === null) return Uint8Array.from(bytes);
      v |= bit << b; // LSB first
    }
    readBit(); // stop bit
    bytes.push(v);
  }
  return Uint8Array.from(bytes);
}

describe('crc16', () => {
  it('matches a known CRC-16/CCITT vector', () => {
    // "123456789" → 0x31C3 for CRC-16/CCITT (poly 0x1021, init 0x0000).
    const data = Uint8Array.from('123456789', (c) => c.charCodeAt(0));
    expect(crc16(data)).toBe(0x31c3);
  });
});

describe('buildCfsBlock', () => {
  it('frames a sync byte, header CRC and data CRC', () => {
    const name = Uint8Array.from('P', (c) => c.charCodeAt(0));
    const data = Uint8Array.from([0x0d, 0xff]);
    const block = buildCfsBlock(name, 0, data, true);

    expect(block[0]).toBe(0x2a); // '*'
    // filename 'P' + 0x00 terminator
    expect(block[1]).toBe('P'.charCodeAt(0));
    expect(block[2]).toBe(0x00);

    // Header runs from filename through the 4 spare bytes: 2 + 4 + 4 + 2 + 2 + 1 + 4 = 19.
    const header = block.slice(1, 1 + 19);
    const headerCrc = (block[20]! << 8) | block[21]!;
    expect(headerCrc).toBe(crc16(header));

    // Then data, then the data CRC (high byte first).
    const dataCrc = (block[block.length - 2]! << 8) | block[block.length - 1]!;
    expect(dataCrc).toBe(crc16(data));
  });

  it('sets the last-block flag only on the final block', () => {
    const big = new Uint8Array(300); // forces two blocks
    big.fill(0x41);
    const blocks = buildCfsBlocks(big, 'BIG');
    expect(blocks).toHaveLength(2);
    // Flag byte sits after filename(3: 'B','I','G')+terminator + 4+4+2+2 = at
    // a fixed offset; rather than hand-count, decode and check via round-trip.
    const flagOffset = 1 + 3 + 1 + 4 + 4 + 2 + 2; // sync + name + nul + load + exec + num + len
    expect(blocks[0]![flagOffset]! & 0x80).toBe(0x00);
    expect(blocks[1]![flagOffset]! & 0x80).toBe(0x80);
  });
});

describe('encodeBbcTape', () => {
  const program = Uint8Array.from([0x0d, 0x00, 0x0a, 0x04, 0xf1, 0x0d, 0xff]);

  it('round-trips the CFS block bytes through the waveform', () => {
    const blocks = buildCfsBlocks(program, 'TEST');
    const expected = blocks.reduce<number[]>((acc, b) => {
      acc.push(...b);
      return acc;
    }, []);
    const samples = encodeBbcTape(program, 'TEST', { sampleRate: SAMPLE_RATE });
    const decoded = decode(samples);
    expect(Array.from(decoded)).toEqual(expected);
  });

  it('robust mode lengthens the recording', () => {
    const normal = encodeBbcTape(program, 'TEST', { sampleRate: SAMPLE_RATE });
    const robust = encodeBbcTape(program, 'TEST', {
      sampleRate: SAMPLE_RATE,
      leaderMs: 4000,
      interBlockMs: 2000,
    });
    expect(robust.length).toBeGreaterThan(normal.length);
  });
});
