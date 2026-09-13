import { describe, expect, it } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { createMapActivities } from './activity';

/** What a sample carries, once it has been inflated again. */
const cellsOf = (deflated: Uint8Array) => [
  ...inflateRawSync(Buffer.from(deflated)),
];

describe('encoding what a machine touched', () => {
  it('compresses the cells and says how wide one is', () => {
    const activities = createMapActivities();
    const sample = activities.encode(Uint8Array.from([1, 0, 2, 3]), 16)!;
    expect(sample.addressesPerCell).toBe(16);
    expect(cellsOf(sample.cells)).toEqual([1, 0, 2, 3]);
  });

  it('skips a sample identical to the one before it', () => {
    // A machine sitting at a prompt touches the same handful of cells frame
    // after frame, and sending each of them again carries nothing.
    const activities = createMapActivities();
    const cells = Uint8Array.from([1, 0, 0, 0]);
    expect(activities.encode(cells, 16)).not.toBeNull();
    expect(activities.encode(cells, 16)).toBeNull();
    cells[3] = 2;
    expect(activities.encode(cells, 16)).not.toBeNull();
  });

  it('sends whatever the cell width changed to, whatever the cells say', () => {
    // A page told one width and then sent another has to hear about it, or it
    // would draw the same cells over the wrong addresses.
    const activities = createMapActivities();
    const cells = Uint8Array.from([1, 0, 0, 0]);
    activities.encode(cells, 16);
    expect(activities.encode(cells, 32)?.addressesPerCell).toBe(32);
  });

  it('sends the next sample whatever it shows once it has been reset', () => {
    const activities = createMapActivities();
    const cells = Uint8Array.from([1]);
    activities.encode(cells, 16);
    activities.reset();
    expect(activities.encode(cells, 16)).not.toBeNull();
  });

  it('compresses a mostly-untouched address space to a fraction of itself', () => {
    // The cells of a machine touching a few regions are mostly zero, which is
    // why the cheapest deflate level is enough.
    const activities = createMapActivities();
    const cells = new Uint8Array(4096);
    cells[100] = 1;
    cells[2000] = 3;
    const sample = activities.encode(cells, 16)!;
    expect(sample.cells.length).toBeLessThan(cells.length / 10);
    expect(cellsOf(sample.cells).length).toBe(cells.length);
  });
});
