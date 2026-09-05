import { describe, it, expect } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import {
  buildSamFile,
  parseSamFile,
  parseSamFileWithReport,
  samBlockScan,
  samBlocks,
  samImageFromBlocks,
  DATA_BLOCK,
  HEADER_BLOCK,
  HEADER_BYTES,
  PROGRAM_TYPE,
} from './samfile';

const program = tokenizeProgram('10 PRINT "hi"\n20 GO TO 10').bytes;

/** A tape block's bytes: type, payload, and the XOR parity SABLK appends. */
function withParity(type: number, payload: Uint8Array): Uint8Array {
  let parity = type;
  for (const b of payload) parity ^= b;
  return Uint8Array.from([type, ...payload, parity]);
}

describe('samcoupe samfile', () => {
  it('frames a header block and a data block, each with its parity byte', () => {
    const image = buildSamFile(program, 'demo');
    const blocks = samBlockScan(image);
    expect(blocks.map((b) => b.type)).toEqual([HEADER_BLOCK, DATA_BLOCK]);
    expect(blocks[0]!.payload).toHaveLength(HEADER_BYTES);
    // The data block is the program area, which ends with the ROM's own
    // end-of-program byte - the interpreter walks lines until it sees one.
    expect(Array.from(blocks[1]!.payload)).toEqual([...program, 0xff]);
    // SABLK seeds the parity with the type byte and folds in each saved byte.
    for (const { type, bytes } of samBlocks(program, { name: 'demo' })) {
      let parity = 0;
      for (const b of bytes.subarray(0, bytes.length - 1)) parity ^= b;
      expect(parity).toBe(bytes[bytes.length - 1]);
      expect(bytes[0]).toBe(type);
    }
  });

  it('describes the program the way a SAM header does', () => {
    const header = samBlockScan(buildSamFile(program, 'demo'))[0]!.payload;
    expect(header[0]).toBe(PROGRAM_TYPE);
    // Name padded to ten characters with spaces, then the four extra name
    // bytes the ROM also clears with spaces.
    expect(Array.from(header.subarray(1, 15))).toEqual([
      ...'demo'.split('').map((c) => c.charCodeAt(0)),
      ...Array(10).fill(0x20),
    ]);
    // The three length fields and the data length are the page form of the
    // program-area length - the lines plus the end-of-program byte: page,
    // offset low, offset high in the 0x8000 window.
    const stored = program.length + 1;
    const pageForm = [0, stored & 0xff, 0x80 | (stored >> 8)];
    for (const at of [16, 19, 22, 34]) {
      expect(Array.from(header.subarray(at, at + 3)), `field ${at}`).toEqual(
        pageForm,
      );
    }
    // Auto-run defaults to the program's first line: a zero, then the number.
    expect(Array.from(header.subarray(37, 40))).toEqual([0, 10, 0]);
    expect(
      Array.from(
        samBlockScan(
          buildSamFile(program, 'demo', { autoStart: null }),
        )[0]!.payload.subarray(37, 38),
      ),
    ).toEqual([0xff]);
  });

  it('reads its own image back, and says what it skipped', () => {
    const image = buildSamFile(program, 'demo');
    expect(Array.from(parseSamFile(image).program)).toEqual(
      Array.from(program),
    );
    const { file, warnings } = parseSamFileWithReport(image);
    expect(file?.name).toBe('demo');
    expect(file?.autoStart).toBe(10);
    expect(warnings).toEqual([]);
    // A corrupted data byte still yields the program, with the parity note.
    const damaged = Uint8Array.from(image);
    damaged[damaged.length - 2] ^= 0xff;
    expect(parseSamFileWithReport(damaged).warnings).toContain(
      'The program data failed its parity check.',
    );
    // A CODE file earlier on the same tape is named and stepped over, not
    // mistaken for the program.
    const codeHeader = new Uint8Array(HEADER_BYTES);
    codeHeader[0] = 19;
    codeHeader.set(
      'loader'.split('').map((c) => c.charCodeAt(0)),
      1,
    );
    codeHeader.fill(0x20, 7, 15);
    const tape = samImageFromBlocks([
      { type: HEADER_BLOCK, bytes: withParity(HEADER_BLOCK, codeHeader) },
      { type: DATA_BLOCK, bytes: withParity(DATA_BLOCK, Uint8Array.of(1, 2)) },
      ...samBlocks(program, { name: 'demo' }),
    ]);
    const scan = parseSamFileWithReport(tape);
    expect(scan.warnings[0]).toBe('Skipped "loader", a CODE file.');
    expect(Array.from(scan.file!.program)).toEqual(Array.from(program));
    expect(parseSamFileWithReport(new Uint8Array(0)).file).toBeNull();
  });
});
