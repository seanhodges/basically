import { describe, expect, it } from 'vitest';
import {
  buildCmdModule,
  buildTrsDisk,
  isJv1Disk,
  JV1_IMAGE_SIZE,
  parseCmdModule,
  parseTrsDisk,
  type Trs80DiskFile,
} from './trs80Disk';
import { buildTrs80DiskImage } from './targets';
import { detokenizeTrs80DiskWithReport } from './detokenizer';

describe('trs80 /CMD load module', () => {
  it('round-trips a block spanning several 254-byte load records', () => {
    const bytes = Uint8Array.from({ length: 600 }, (_, i) => i & 0xff);
    const module = buildCmdModule(0x7000, bytes, 0x7005);
    const parsed = parseCmdModule(module)!;
    expect(parsed.address).toBe(0x7000);
    expect(parsed.entry).toBe(0x7005);
    expect(Array.from(parsed.bytes)).toEqual(Array.from(bytes));
  });

  it('defaults entry to the load address when they match', () => {
    const bytes = Uint8Array.of(0xa9, 0x00, 0xc9);
    const parsed = parseCmdModule(buildCmdModule(0x6000, bytes, 0x6000))!;
    expect(parsed.address).toBe(0x6000);
    expect(parsed.entry).toBe(0x6000);
    expect(Array.from(parsed.bytes)).toEqual([0xa9, 0x00, 0xc9]);
  });
});

describe('trs80 .dsk (JV1 + TRSDOS) codec', () => {
  it('is exactly a Model I single-density image', () => {
    const dsk = buildTrsDisk([
      { name: 'A', ext: 'BAS', bytes: Uint8Array.of(1) },
    ]);
    expect(dsk.length).toBe(JV1_IMAGE_SIZE);
    expect(isJv1Disk(dsk)).toBe(true);
  });

  it('round-trips several files with exact bytes and names', () => {
    const files: Trs80DiskFile[] = [
      { name: 'GAME', ext: 'BAS', bytes: Uint8Array.of(0xff, 1, 2, 3, 0, 0) },
      {
        name: 'SPRITES',
        ext: 'CMD',
        bytes: Uint8Array.from({ length: 300 }, (_, i) => (i * 7) & 0xff),
      },
      { name: 'SMALL', ext: 'BAS', bytes: Uint8Array.of(0xff, 9, 9, 0, 0) },
    ];
    const parsed = parseTrsDisk(buildTrsDisk(files));
    expect(parsed.entries).toHaveLength(3);
    for (const f of files) {
      const got = parsed.entries.find((e) => e.name === f.name)!;
      expect(got.ext).toBe(f.ext);
      expect(Array.from(got.bytes)).toEqual(Array.from(f.bytes));
    }
  });

  it('isJv1Disk rejects a short/non-disc image', () => {
    expect(isJv1Disk(Uint8Array.of(0x00, 0xa5, 0xd3, 0xd3, 0xd3))).toBe(false);
    expect(isJv1Disk(new Uint8Array(JV1_IMAGE_SIZE))).toBe(false); // no files
  });

  it('imports largest BASIC as source, extra BASIC as tapeFiles, code as block', () => {
    // The single-program main image supplies a real tokenized /BAS payload to
    // reuse as the disc's "main" file; a tiny second /BAS becomes a tape file.
    const main = parseTrsDisk(
      buildTrs80DiskImage(
        '10 PRINT "MAIN PROGRAM IS THE LONGER ONE"\n20 GOTO 10\n',
        'MAIN',
      ),
    ).entries[0]!;

    const image = buildTrsDisk([
      { name: 'MAIN', ext: 'BAS', bytes: main.bytes },
      { name: 'SMALL', ext: 'BAS', bytes: Uint8Array.of(0xff, 0, 0, 0, 0) },
      {
        name: 'SPRITES',
        ext: 'CMD',
        bytes: buildCmdModule(0x7000, Uint8Array.of(0x3e, 0x01, 0xc9), 0x7000),
      },
    ]);

    const report = detokenizeTrs80DiskWithReport(image);
    expect(report.source).toContain('MAIN PROGRAM IS THE LONGER ONE');
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]!.address).toBe(0x7000);
    expect(report.tapeFiles).toHaveLength(1);
    expect(report.warnings.join(' ')).toMatch(/Multi-file disk image/);
  });
});
