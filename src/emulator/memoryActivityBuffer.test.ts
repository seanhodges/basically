import { describe, it, expect } from 'vitest';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from './memoryActivityBuffer';

describe('MemoryActivityBuffer', () => {
  it('starts disabled with a zeroed buffer of the requested size', () => {
    const buf = new MemoryActivityBuffer(0x100);
    expect(buf.enabled).toBe(false);
    expect(buf.hits).toHaveLength(0x100);
    expect(buf.hits.every((b) => b === 0)).toBe(true);
  });

  it('defaults to a 64K address space', () => {
    expect(new MemoryActivityBuffer().hits).toHaveLength(0x10000);
  });

  it('drain returns the filled buffer and installs a fresh zeroed one', () => {
    const buf = new MemoryActivityBuffer(0x100);
    buf.hits[0x10] |= READ_BIT;
    buf.hits[0x20] |= WRITE_BIT;
    buf.hits[0x30] |= READ_BIT | WRITE_BIT;

    const filled = buf.drain();
    expect(filled[0x10]).toBe(READ_BIT);
    expect(filled[0x20]).toBe(WRITE_BIT);
    expect(filled[0x30]).toBe(READ_BIT | WRITE_BIT);
    // The installed buffer is a different, zeroed array.
    expect(buf.hits).not.toBe(filled);
    expect(buf.hits.every((b) => b === 0)).toBe(true);
  });

  it('drain reuses a recycled buffer of matching length, zeroed', () => {
    const buf = new MemoryActivityBuffer(0x100);
    buf.hits[5] |= READ_BIT;
    const first = buf.drain();

    // Dirty the recycled buffer to prove drain zeroes it before installing.
    first[7] |= WRITE_BIT;
    buf.hits[9] |= WRITE_BIT;
    const second = buf.drain(first);

    // The recycled array is now the active fill target, zeroed.
    expect(buf.hits).toBe(first);
    expect(buf.hits.every((b) => b === 0)).toBe(true);
    // The just-drained buffer carries its own hits, untouched by the recycle.
    expect(second[9]).toBe(WRITE_BIT);
  });

  it('drain allocates fresh when the recycled buffer is the wrong size', () => {
    const buf = new MemoryActivityBuffer(0x100);
    const wrongSize = new Uint8Array(0x80);
    const filled = buf.drain(wrongSize);
    expect(buf.hits).not.toBe(wrongSize);
    expect(buf.hits).toHaveLength(0x100);
    expect(filled).toHaveLength(0x100);
  });

  it('clear zeroes the buffer in place', () => {
    const buf = new MemoryActivityBuffer(0x100);
    buf.hits[1] |= READ_BIT;
    buf.hits[2] |= WRITE_BIT;
    const before = buf.hits;
    buf.clear();
    expect(buf.hits).toBe(before); // same array, cleared in place
    expect(buf.hits.every((b) => b === 0)).toBe(true);
  });
});
