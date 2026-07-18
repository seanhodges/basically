import { describe, expect, it } from 'vitest';
import {
  buildTap,
  codeTap,
  parseTap,
  parseTapAllFiles,
  tapFromPayloads,
} from './tapfile';
import { tokenizeProgram } from './tokenizer';

const program = tokenizeProgram('10 PRINT "HI"\n20 GO TO 10\n').bytes;

function name10(text: string): Uint8Array {
  const bytes = new Uint8Array(10).fill(0x20);
  for (let i = 0; i < Math.min(text.length, 10); i++) {
    bytes[i] = text.charCodeAt(i);
  }
  return bytes;
}

/** A CODE header (type 3): declared length, load address, name. */
function codeHeader(name: string, address: number, length: number): Uint8Array {
  const h = new Uint8Array(17);
  h[0] = 0x03; // CODE
  h.set(name10(name), 1);
  h[11] = length & 0xff;
  h[12] = (length >> 8) & 0xff;
  h[13] = address & 0xff;
  h[14] = (address >> 8) & 0xff;
  h[15] = 0x00; // param2 unused for CODE
  h[16] = 0x80;
  return h;
}

function codeFile(name: string, address: number, bytes: number[]): Uint8Array {
  const data = Uint8Array.from(bytes);
  return tapFromPayloads(codeHeader(name, address, data.length), data);
}

/** A number-array header (type 1): preserved as a tape file, not a CODE block. */
function arrayFile(name: string, bytes: number[]): Uint8Array {
  const data = Uint8Array.from(bytes);
  const h = new Uint8Array(17);
  h[0] = 0x01; // number array
  h.set(name10(name), 1);
  h[11] = data.length & 0xff;
  h[12] = (data.length >> 8) & 0xff;
  return tapFromPayloads(h, data);
}

describe('zxspectrum .TAP', () => {
  it('builds a header block and a data block with valid parity', () => {
    const tap = buildTap(program);
    // header block: u16 length=19, then 17 header bytes + parity
    expect(tap[0]! | (tap[1]! << 8)).toBe(19);
    let parity = 0;
    for (let i = 2; i < 2 + 18; i++) parity ^= tap[i]!;
    expect(parity).toBe(tap[2 + 18]!); // flag..last XOR == parity byte
  });

  it('records program length and auto-start line in the header', () => {
    const { header, autoStart } = parseTap(buildTap(program));
    expect(header[0]).toBe(0x00); // program type
    expect(header[15]! | (header[16]! << 8)).toBe(program.length);
    expect(autoStart).toBe(10); // first line
  });

  it('round-trips the program area and appends the variables marker', () => {
    const parsed = parseTap(buildTap(program));
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
    expect(parsed.data[parsed.data.length - 1]).toBe(0x80); // empty vars
  });

  it('honours autoStart: null (load-only)', () => {
    expect(
      parseTap(buildTap(program, { autoStart: null })).autoStart,
    ).toBeNull();
  });

  it('rejects non-program images', () => {
    expect(() => parseTap(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

describe('parseTapAllFiles', () => {
  it('rejects non-program images', () => {
    expect(() => parseTapAllFiles(new Uint8Array([1, 2, 3]))).toThrow();
  });

  it('returns the BASIC program when there are no CODE files', () => {
    const image = buildTap(program);
    const { program: parsed, code, warnings } = parseTapAllFiles(image);
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
    expect(code).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('reads back a codeTap() as a CODE file (name, address, bytes)', () => {
    // codeTap builds the CODE .TAP the tape deck serves for an imported block;
    // it must round-trip through the same parser that reads real dumps.
    const image = new Uint8Array([
      ...buildTap(program),
      ...codeTap('o', 27392, Uint8Array.from([0xc9, 0x00, 0x01])),
    ]);
    const { code } = parseTapAllFiles(image);
    expect(code).toHaveLength(1);
    expect(code[0]!.name).toBe('o');
    expect(code[0]!.address).toBe(27392);
    expect(Array.from(code[0]!.bytes)).toEqual([0xc9, 0x00, 0x01]);
  });

  it('collects a CODE file with its load address (param1) and bytes', () => {
    const image = new Uint8Array([
      ...buildTap(program),
      ...codeFile('screen$', 32768, [0x21, 0x00, 0x40, 0xc9]),
    ]);
    const { program: parsed, code, warnings } = parseTapAllFiles(image);
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
    expect(code).toHaveLength(1);
    expect(code[0]!.address).toBe(32768); // param1 round-trip: 0x8000
    expect(Array.from(code[0]!.bytes)).toEqual([0x21, 0x00, 0x40, 0xc9]);
    expect(code[0]!.name).toBe('screen$');
    expect(warnings).toEqual([]);
  });

  it('slices CODE bytes to the header-declared length, dropping trailer padding', () => {
    // A data block that carries one extra trailing byte beyond the header's
    // declared length (as some real dumps do); the extra byte must not leak
    // into the returned block bytes.
    const header = codeHeader('pad', 0x9000, 3);
    const data = Uint8Array.from([0xaa, 0xbb, 0xcc, 0xff]);
    const image = new Uint8Array([
      ...buildTap(program),
      ...tapFromPayloads(header, data),
    ]);
    const { code } = parseTapAllFiles(image);
    expect(Array.from(code[0]!.bytes)).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it('collects multiple CODE files in tape order', () => {
    const image = new Uint8Array([
      ...buildTap(program),
      ...codeFile('a', 0x8000, [1, 2, 3]),
      ...codeFile('b', 0x9000, [4, 5]),
    ]);
    const { code } = parseTapAllFiles(image);
    expect(code.map((c) => c.name)).toEqual(['a', 'b']);
    expect(code.map((c) => c.address)).toEqual([0x8000, 0x9000]);
  });

  it('preserves an array as a tape file instead of dropping it', () => {
    const image = new Uint8Array([
      ...buildTap(program),
      ...arrayFile('nums', [1, 2, 3, 4]),
    ]);
    const { code, tapeFiles, warnings } = parseTapAllFiles(image);
    expect(code).toEqual([]);
    expect(tapeFiles).toHaveLength(1);
    expect(tapeFiles[0]!.name).toBe('nums');
    expect(tapeFiles[0]!.kind).toBe('data-num');
    expect(warnings.join(' ')).toMatch(/multi-part tape/);
  });

  it('opens the largest program and preserves a smaller loader as a tape file', () => {
    const loader = tokenizeProgram('1 LOAD ""CODE\n').bytes;
    const game = tokenizeProgram(
      '10 PRINT "THE ACTUAL GAME WITH LOTS MORE TEXT"\n20 GO TO 10\n',
    ).bytes;
    // Loader first on the tape, as on real hardware - selection is by size, not
    // tape order, so the game (larger) must still be the one opened.
    const image = new Uint8Array([...buildTap(loader), ...buildTap(game)]);
    const { program: parsed, tapeFiles, warnings } = parseTapAllFiles(image);
    expect(Array.from(parsed.program)).toEqual(Array.from(game));
    expect(tapeFiles).toHaveLength(1);
    expect(tapeFiles[0]!.kind).toBe('program');
    // The preserved loader round-trips as a real program .TAP.
    expect(Array.from(parseTap(tapeFiles[0]!.tap).program)).toEqual(
      Array.from(loader),
    );
    expect(warnings.join(' ')).toMatch(/multi-part tape/);
  });

  it('leaves tapeFiles empty for a single-program tape', () => {
    const { tapeFiles, warnings } = parseTapAllFiles(buildTap(program));
    expect(tapeFiles).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('handles the multi-part layout of a real game tape (loader, screen, game, UDG)', () => {
    // Mirrors LOSAGAN.TAP: a tiny loader, a SCREEN$ CODE block, the big game
    // program, and a UDG CODE block. The game is opened; the loader is
    // preserved on tape; both CODE blocks come back as code files.
    const loader = tokenizeProgram('10 LOAD ""SCREEN$\n20 LOAD ""\n').bytes;
    const game = tokenizeProgram(
      '10 PRINT "SAGAN"\n20 PRINT "A LONG MAIN GAME PROGRAM BODY HERE"\n30 GO TO 10\n',
    ).bytes;
    const image = new Uint8Array([
      ...buildTap(loader, { name: 'LOADER' }),
      ...codeFile('LDS', 16384, [0, 1, 2, 3]),
      ...buildTap(game, { name: 'LS' }),
      ...codeFile('UDG', 65368, [4, 5, 6]),
    ]);
    const { program: parsed, code, tapeFiles } = parseTapAllFiles(image);
    expect(Array.from(parsed.program)).toEqual(Array.from(game));
    expect(code.map((c) => c.name)).toEqual(['LDS', 'UDG']);
    expect(tapeFiles.map((t) => t.name)).toEqual(['LOADER']);
    expect(tapeFiles[0]!.kind).toBe('program');
  });
});
