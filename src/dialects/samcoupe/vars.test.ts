/**
 * The variable walk against hand-built areas, where a record can be malformed
 * on purpose. What a real machine puts there is checked in
 * `./introspection.test.ts`, on a booted ROM.
 */
import { describe, it, expect } from 'vitest';
import { readSamcoupeVariables, type SamVarsPort } from './vars';
import { encodeSamNumber } from './numbers';

/** The 26-word first-letter table the numeric area opens with. */
const TABLE_BYTES = 52;

/** A flat BASIC-area image with the four boundaries laid over it. */
class Area {
  readonly bytes = new Uint8Array(0x4000);
  nvars = 0x100;
  numend = 0x100 + TABLE_BYTES;
  savars = 0x400;
  eline = 0x400;

  constructor() {
    // An empty numeric table is 26 "no variables start with this letter" words.
    this.bytes.fill(0xff, this.nvars, this.nvars + TABLE_BYTES);
    this.bytes[this.savars] = 0xff; // the string/array list's stopper
  }

  /** Append a numeric record and link it onto its first letter's chain. */
  number(name: string, value: number, type = 0): void {
    const letter = name.charCodeAt(0) - 0x61;
    const extra = name.length - 1;
    const record = this.numend;
    // Walk to the end of this letter's chain and hang the record off it.
    let slot = this.nvars + letter * 2;
    while (this.bytes[slot + 1] !== 0xff) {
      slot = slot + 1 + (this.bytes[slot]! | (this.bytes[slot + 1]! << 8)) + 1;
    }
    const displacement = record - (slot + 1);
    this.bytes[slot] = displacement & 0xff;
    this.bytes[slot + 1] = displacement >> 8;

    this.bytes[record] = type | extra;
    this.bytes[record + 1] = 0xff;
    this.bytes[record + 2] = 0xff;
    for (let i = 0; i < extra; i++)
      this.bytes[record + 3 + i] = name.charCodeAt(i + 1);
    this.bytes.set(encodeSamNumber(value), record + 3 + extra);
    this.numend = record + 3 + extra + 5;
  }

  /** Append a string or array record to the list at SAVARS. */
  entry(name: string, type: number, data: number[]): void {
    const record = this.eline;
    this.bytes[record] = type | name.length;
    for (let i = 0; i < name.length; i++)
      this.bytes[record + 1 + i] = name.charCodeAt(i);
    this.bytes[record + 11] = Math.floor(data.length / 0x4000);
    this.bytes[record + 12] = data.length & 0xff;
    this.bytes[record + 13] = (data.length >> 8) & 0xff;
    this.bytes.set(data, record + 14);
    this.eline = record + 14 + data.length;
    this.bytes[this.eline] = 0xff;
  }

  get port(): SamVarsPort {
    return {
      read: (addr) => this.bytes[addr] ?? 0,
      nvars: this.nvars,
      numend: this.numend,
      savars: this.savars,
      eline: this.eline,
    };
  }
}

describe('samcoupe variables', () => {
  it('finds nothing in the areas a reset machine would have', () => {
    expect(readSamcoupeVariables(new Area().port)).toEqual([]);
  });

  it("follows each first letter's chain, and carries the letter it hangs on", () => {
    const area = new Area();
    area.number('a', 1);
    area.number('able', 2);
    area.number('b', 3);
    expect(
      readSamcoupeVariables(area.port).map((v) => `${v.name}=${v.value}`),
    ).toEqual(['A=1', 'ABLE=2', 'B=3']);
  });

  it('shows a FOR control variable as its live counter', () => {
    const area = new Area();
    // Bit 6 marks the record as a FOR variable; its limit, step and loop
    // position follow the value, and the chain steps over all of them.
    area.number('i', 4, 0x40);
    area.numend += 16;
    area.number('j', 5);
    expect(readSamcoupeVariables(area.port).map((v) => v.name)).toEqual([
      'I',
      'J',
    ]);
    expect(readSamcoupeVariables(area.port)[0]!.value).toBe('4');
  });

  it('reads strings and both kinds of array out of the second area', () => {
    const area = new Area();
    area.entry(
      'q',
      0x00,
      [...'hi'].map((c) => c.charCodeAt(0)),
    );
    area.entry('n', 0x20, [
      1,
      2,
      0,
      ...encodeSamNumber(7),
      ...encodeSamNumber(8),
    ]);
    area.entry('s', 0x40, [1, 3, 0, 32, 32, 32]);
    expect(readSamcoupeVariables(area.port)).toEqual([
      expect.objectContaining({ name: 'Q$', kind: 'string', value: '"hi"' }),
      expect.objectContaining({
        name: 'N()',
        kind: 'number-array',
        value: '[2] = 7, 8',
      }),
      expect.objectContaining({
        name: 'S$()',
        kind: 'string-array',
        value: '[3]',
      }),
    ]);
  });

  it('stops rather than misreads when the pointers are not yet laid down', () => {
    const area = new Area();
    area.number('a', 1);
    // Mid-boot, and mid-injection, the three pointers can be anything.
    expect(
      readSamcoupeVariables({ ...area.port, numend: area.nvars - 1 }),
    ).toEqual([]);
    expect(
      readSamcoupeVariables({ ...area.port, savars: area.eline + 1 }),
    ).toEqual([]);
    // A record that claims to reach past the end of its area is dropped, not
    // read out of whatever lies beyond it.
    expect(
      readSamcoupeVariables({ ...area.port, numend: area.nvars + TABLE_BYTES }),
    ).toEqual([]);
  });
});
