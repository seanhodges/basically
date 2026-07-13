import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { petCharset } from './charset';
import { petKeywords } from './keywords';
import { pet } from './index';

/**
 * Stage 1 (language core) tests for the PET dialect — see
 * docs/contributing/dialect-plans/pet.md. The emulator/keyboard/tape stages
 * keep their own `it.todo` placeholders below.
 */
describe('pet dialect', () => {
  // ---- Stage 1 — language core ------------------------------------------

  it('tokenizes the BASIC 4.0 disk keywords to $CC-$DA', () => {
    // Every disk command with its documented token, in table order.
    const cases: [string, number][] = [
      ['CONCAT', 0xcc],
      ['DOPEN', 0xcd],
      ['DCLOSE', 0xce],
      ['RECORD', 0xcf],
      ['HEADER', 0xd0],
      ['COLLECT', 0xd1],
      ['BACKUP', 0xd2],
      ['COPY', 0xd3],
      ['APPEND', 0xd4],
      ['DSAVE', 0xd5],
      ['DLOAD', 0xd6],
      ['CATALOG', 0xd7],
      ['RENAME', 0xd8],
      ['SCRATCH', 0xd9],
      ['DIRECTORY', 0xda],
    ];
    for (const [word, token] of cases) {
      const { program, errors } = tokenizeProgram(`10 ${word}\n`);
      expect(errors).toEqual([]);
      // First body byte (after the 4-byte link + line-number header) is the token.
      expect(program[4]).toBe(token);
    }
  });

  it('assembles linked-line pointers from $0401', () => {
    const { program, errors } = tokenizeProgram('10 PRINT "HI"\n');
    expect(errors).toEqual([]);
    // link ($040d), line 10, PRINT, space, "HI", 0x00, then 0x0000 end.
    expect(Array.from(program)).toEqual([
      0x0c,
      0x04, // link to next line ($040c) — base is $0401, not the C64's $0801
      0x0a,
      0x00, // line number 10
      0x99, // PRINT
      0x20, // space
      0x22,
      0x48,
      0x49,
      0x22, // "HI"
      0x00, // end of line
      0x00,
      0x00, // end of program
    ]);
  });

  it('round-trips tokenize -> detokenize, including DLOAD"X",D0 lines', () => {
    const src =
      '10 PRINT "HI"\n20 DLOAD"X",D0\n30 SCRATCH"OLD",D0\n40 FOR I=1 TO 10\n50 NEXT I\n';
    const { program, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    // DLOAD($d6) and SCRATCH($d9) round-trip through the BASIC 4.0 decode table.
    expect(Array.from(program)).toContain(0xd6);
    expect(Array.from(program)).toContain(0xd9);
    expect(detokenizeProgram(program)).toBe(src);
  });

  it('round-trips all 256 PETSCII codes through the charset', () => {
    for (let code = 0; code < 256; code++) {
      const text = petCharset.toUnicode([code]);
      expect(Array.from(petCharset.toMachine(text))).toEqual([code]);
    }
  });

  it('warns when importing a .prg with a non-$0401 load address', () => {
    const { program } = tokenizeProgram('10 PRINT "HI"\n');
    // $0801 is the C64 base — a PET import should flag it rather than silently
    // mis-locating the program.
    const prg = Uint8Array.from([0x01, 0x08, ...program]);
    const { warnings } = detokenizeProgramWithReport(prg);
    expect(warnings.some((w) => /load address is \$0801/i.test(w))).toBe(true);
    expect(warnings.some((w) => /PET/i.test(w))).toBe(true);
  });

  it('exposes the disk keywords through the dialect and lints them cleanly', () => {
    // The dialect surface is wired for Stage 1 (tokenize/detokenize/lint).
    expect(petKeywords.some((k) => k.word === 'DIRECTORY')).toBe(true);
    const result = pet.tokenize('10 DOPEN#1,"DATA"\n');
    expect(result.errors).toEqual([]);
    // Load address prepended to the program is $0401.
    expect(Array.from(result.image.slice(0, 2))).toEqual([0x01, 0x04]);
    // DOPEN must not be flagged as an undeclared variable.
    expect(pet.lint('10 DOPEN#1,"DATA"\n')).toEqual([]);
  });

  // ---- Stage 2 — emulator core ------------------------------------------
  // Covered by src/emulator/pet/petMachine.test.ts (boots the BASIC 4.0 ROMs to
  // READY. and runs an injected program) and the shared-chip unit tests under
  // src/emulator/commodore/.
  it('advertises the emulator surface (displaySize + createEmulator)', () => {
    expect(pet.displaySize).toEqual({ width: 360, height: 250 });
    expect(typeof pet.createEmulator).toBe('function');
    expect(pet.romUrl).toMatch(/roms\/pet\/kernal/);
  });

  // ---- Stage 3 — wire-up ------------------------------------------------
  it.todo('validates the keyboard layout and key matrix (physical+virtual)');
  it.todo('tokenizes every bundled sample cleanly');

  // ---- Stage 4 — transfer & tape I/O ------------------------------------
  it.todo('round-trips cassette encode -> decode at $0401');
});
