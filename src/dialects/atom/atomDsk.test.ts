import { describe, expect, it } from 'vitest';
import {
  buildAtomDsk,
  composeAtomDskFiles,
  isAtomDsk,
  parseAtomDsk,
} from './atomDsk';
import { buildAtm } from './atm';
import { buildAtomImage } from './audio/cassetteEncoder';
import { detokenizeAtomDskWithReport } from './detokenizer';
import type { Block } from '../types';

const block = (over: Partial<Block>): Block => ({
  id: 'b1',
  name: 'sprite',
  address: 0x5000,
  bytes: Uint8Array.of(0xa9, 0x00, 0x60),
  kind: 'code',
  ...over,
});

describe('atom .dsk codec', () => {
  it('round-trips a BASIC program plus two blocks with distinct entries', () => {
    const image = buildAtomImage('10 PRINT "HI"\n');
    const blocks = [
      block({ name: 'sprite', address: 0x5000, entry: 0x5003 }),
      block({
        id: 'b2',
        name: 'data',
        address: 0x6000,
        bytes: Uint8Array.of(1, 2, 3, 4),
        kind: 'memory',
      }),
    ];
    const entries = composeAtomDskFiles(image, blocks, 'GAME');
    const dsk = buildAtomDsk(entries, 'GAME');

    expect(isAtomDsk(dsk)).toBe(true);

    const parsed = parseAtomDsk(dsk);
    // BASIC file at #2900 plus the two blocks.
    expect(parsed.entries).toHaveLength(3);
    const basic = parsed.entries.find((e) => e.load === 0x2900)!;
    expect(Array.from(basic.bytes)).toEqual(Array.from(image));

    const sprite = parsed.entries.find((e) => e.load === 0x5000)!;
    expect(sprite.exec).toBe(0x5003);
    expect(Array.from(sprite.bytes)).toEqual([0xa9, 0x00, 0x60]);

    const data = parsed.entries.find((e) => e.load === 0x6000)!;
    expect(data.exec).toBe(0x6000); // no entry → exec = load
    expect(Array.from(data.bytes)).toEqual([1, 2, 3, 4]);
  });

  it('de-duplicates catalogue names that collide after sanitising', () => {
    const image = buildAtomImage('10 END\n');
    const blocks = [
      block({ id: 'b1', name: 'longname_a', address: 0x5000 }),
      block({ id: 'b2', name: 'longname_b', address: 0x6000 }),
    ];
    const entries = composeAtomDskFiles(image, blocks, 'PROG');
    const names = entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('isAtomDsk rejects a bare #2900 image and an .atm', () => {
    const image = buildAtomImage('10 PRINT "HI"\n');
    expect(isAtomDsk(image)).toBe(false);
    expect(isAtomDsk(buildAtm(image, 'HI'))).toBe(false);
  });

  it('imports the largest BASIC as source, extra BASIC as tapeFiles, code as blocks', () => {
    const big = buildAtomImage(
      '10 PRINT "MAIN PROGRAM IS LONGER"\n20 GOTO 10\n',
    );
    const small = buildAtomImage('10 END\n');
    const entries = [
      { name: 'SMALL', load: 0x2900, exec: 0x2900, bytes: small },
      { name: 'MAIN', load: 0x2900, exec: 0x2900, bytes: big },
      {
        name: 'CODE',
        load: 0x5000,
        exec: 0x5003,
        bytes: Uint8Array.of(0xa9, 0, 0x60),
      },
    ];
    const report = detokenizeAtomDskWithReport(buildAtomDsk(entries, 'DISK'));

    expect(report.source).toContain('MAIN PROGRAM IS LONGER');
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]!.address).toBe(0x5000);
    expect(report.blocks![0]!.entry).toBe(0x5003);
    expect(report.tapeFiles).toHaveLength(1);
    expect(report.warnings.join(' ')).toMatch(/Multi-file disk image/);
  });
});
