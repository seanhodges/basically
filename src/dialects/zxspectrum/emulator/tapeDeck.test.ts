import { describe, expect, it } from 'vitest';
import type { MachineFileEntry, MachineFileStore } from '../../types';
import { tapBlockScan } from '../tapfile';
import { VfsTapeDeck } from './tapeDeck';

/** Map-backed MachineFileStore for tests. */
function fakeStore(): MachineFileStore & { names(): string[] } {
  const files = new Map<string, { data: Uint8Array; kind?: string }>();
  return {
    save: (name, data, meta) =>
      files.set(name, { data: data.slice(), kind: meta?.kind }),
    load: (name) => files.get(name)?.data.slice() ?? null,
    list: (): MachineFileEntry[] =>
      [...files.entries()].map(([name, f]) => ({
        name,
        size: f.data.length,
        updatedAt: 1,
        kind: f.kind,
      })),
    delete: (name) => files.delete(name),
    names: () => [...files.keys()],
  };
}

/** A 17-byte tape header: type, 10-char name, length, param1, param2. */
function header(type: number, name: string, length: number): Uint8Array {
  const h = new Uint8Array(17);
  h[0] = type;
  for (let i = 0; i < 10; i++) {
    h[1 + i] = i < name.length ? name.charCodeAt(i) : 0x20;
  }
  h[11] = length & 0xff;
  h[12] = (length >> 8) & 0xff;
  return h;
}

describe('VfsTapeDeck.recordBlock', () => {
  it('captures a CODE save as one named two-block .TAP', () => {
    const files = fakeStore();
    const deck = new VfsTapeDeck(files);
    const payload = new Uint8Array([1, 2, 3, 4]);
    expect(deck.recordBlock(0x00, header(3, 'BYTES', 4))).toBe(true);
    expect(deck.recordBlock(0xff, payload)).toBe(true);
    expect(files.names()).toEqual(['BYTES']);
    expect(files.list()[0]!.kind).toBe('code');
    const blocks = tapBlockScan(files.load('BYTES')!);
    expect(blocks.map((b) => b.flag)).toEqual([0x00, 0xff]);
    expect(blocks[0]!.payload[0]).toBe(3); // type byte survives
    expect(blocks[1]!.payload).toEqual(payload);
  });

  it('tags array saves by header type', () => {
    const files = fakeStore();
    const deck = new VfsTapeDeck(files);
    deck.recordBlock(0x00, header(1, 'NUMS', 2));
    deck.recordBlock(0xff, new Uint8Array(2));
    deck.recordBlock(0x00, header(2, 'WORDS', 2));
    deck.recordBlock(0xff, new Uint8Array(2));
    const kinds = Object.fromEntries(files.list().map((f) => [f.name, f.kind]));
    expect(kinds).toEqual({ NUMS: 'data-num', WORDS: 'data-str' });
  });

  it('passes a BASIC program save through, including its data block', () => {
    const files = fakeStore();
    const deck = new VfsTapeDeck(files);
    expect(deck.recordBlock(0x00, header(0, 'PROG', 10))).toBe(false);
    expect(deck.recordBlock(0xff, new Uint8Array(10))).toBe(false);
    expect(files.names()).toEqual([]);
    // The pass-through is fully disarmed: a data save afterwards still works.
    expect(deck.recordBlock(0x00, header(3, 'GOOD', 1))).toBe(true);
    expect(deck.recordBlock(0xff, new Uint8Array(1))).toBe(true);
    expect(files.names()).toEqual(['GOOD']);
  });

  it('passes headerless data blocks and nonstandard flags through', () => {
    const deck = new VfsTapeDeck(fakeStore());
    expect(deck.recordBlock(0xff, new Uint8Array(4))).toBe(false);
    expect(deck.recordBlock(0x55, new Uint8Array(4))).toBe(false);
  });

  it('rewind forgets a half-captured save', () => {
    const files = fakeStore();
    const deck = new VfsTapeDeck(files);
    deck.recordBlock(0x00, header(3, 'HALF', 1));
    deck.rewind(); // e.g. BREAK between the two blocks, then a new run
    expect(deck.recordBlock(0xff, new Uint8Array(1))).toBe(false);
    expect(files.names()).toEqual([]);
  });
});

describe('VfsTapeDeck.nextBlock', () => {
  function deckWithFiles(names: string[]) {
    const files = fakeStore();
    const deck = new VfsTapeDeck(files);
    for (const name of names) {
      deck.recordBlock(0x00, header(3, name, 2));
      deck.recordBlock(0xff, new Uint8Array([7, 7]));
    }
    return deck;
  }

  it('serves header then data for a stored file', () => {
    const deck = deckWithFiles(['A']);
    const h = deck.nextBlock(0x00);
    expect(h.kind).toBe('block');
    expect((h as { payload: Uint8Array }).payload[0]).toBe(3);
    const d = deck.nextBlock(0xff);
    expect(d).toMatchObject({ kind: 'block' });
  });

  it('reports error on a flag mismatch and advances the tape', () => {
    const deck = deckWithFiles(['A', 'B']);
    expect(deck.nextBlock(0x00).kind).toBe('block'); // header A
    // ROM rejects the name and asks for another header — data A is under
    // the head, so this call errors, then header B is served.
    expect(deck.nextBlock(0x00).kind).toBe('error');
    const h = deck.nextBlock(0x00);
    expect(h.kind).toBe('block');
  });

  it('aborts after cycling the whole tape twice with no data consumed', () => {
    const deck = deckWithFiles(['A', 'B']);
    const results: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = deck.nextBlock(0x00); // ROM never finds a matching name
      results.push(r.kind);
      if (r.kind === 'abort') break;
    }
    expect(results[results.length - 1]).toBe('abort');
    expect(results.length).toBeLessThanOrEqual(9); // 2×4 blocks, then abort
  });

  it('aborts immediately when the store is empty', () => {
    const deck = new VfsTapeDeck(fakeStore());
    expect(deck.hasFiles()).toBe(false);
    expect(deck.nextBlock(0x00).kind).toBe('abort');
  });

  it('recovers for a fresh LOAD after an abort', () => {
    const deck = deckWithFiles(['A']);
    for (let i = 0; i < 10 && deck.nextBlock(0x00).kind !== 'abort'; i++) {
      // spin to the abort
    }
    expect(deck.nextBlock(0x00).kind).toBe('block'); // next search starts clean
  });
});
