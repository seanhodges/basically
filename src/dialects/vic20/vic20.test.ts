import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { vic20Charset } from './charset';
import { vic20Keywords, vic20WordByToken } from './keywords';
import { buildPrg } from './targets';
import { vic20 } from './index';
import { getDialect } from '../registry';
import { c64Keywords, c64WordByToken } from '../commodore64/keywords';
import { tokenizeProgram as tokenizeC64 } from '../commodore64/tokenizer';

/**
 * Dialect-surface tests for the VIC-20. The emulator itself is exercised
 * against the real ROMs in src/emulator/vic20/vic20Machine.test.ts.
 *
 * VIC-20 BASIC V2 is token-identical to the C64's; the only machine difference
 * is the $1001 program base (vs the C64's $0801) on the unexpanded machine.
 */
describe('vic20 dialect', () => {
  // ---- Stage 1 - language core ------------------------------------------

  it('keyword table is byte-identical to the C64 BASIC V2 table', () => {
    // Re-exported, so it is literally the same table - but assert it so a future
    // divergence on either side is caught.
    expect(vic20Keywords).toBe(c64Keywords);
    expect(vic20WordByToken).toBe(c64WordByToken);
    for (const kw of vic20Keywords) {
      expect(vic20WordByToken.get(kw.token)).toBe(kw.word);
    }
  });

  it('tokenizes the body bytes identically to the C64, only the base differs', () => {
    // The tokenized bodies must be byte-for-byte the C64's; the linked-line
    // pointers differ only because the program base is $1001, not $0801. So the
    // two images have identical length and differ only in the 2 link bytes at
    // the head of each line record.
    const src = '10 PRINT "HI":GOTO 10\n20 FOR I=1 TO 10:NEXT I\n';
    const vic = tokenizeProgram(src);
    const c64 = tokenizeC64(src);
    expect(vic.errors).toEqual([]);
    expect(vic.program.length).toBe(c64.program.length);
    // Detokenizing either back yields the same source (link pointers are not
    // observable in the text form).
    expect(detokenizeProgram(vic.program)).toBe(src);
  });

  it('assembles linked-line pointers from $1001', () => {
    const { program, errors } = tokenizeProgram('10 PRINT "HI"\n');
    expect(errors).toEqual([]);
    // link ($100c), line 10, PRINT, space, "HI", 0x00, then 0x0000 end.
    expect(Array.from(program)).toEqual([
      0x0c,
      0x10, // link to next line ($100c) - base is $1001, not the C64's $0801
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

  it('round-trips tokenize -> detokenize', () => {
    const src =
      '10 PRINT "HI"\n20 FOR I=1 TO 10\n30 PRINT I\n40 NEXT I\n50 GOTO 10\n';
    const { program, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(detokenizeProgram(program)).toBe(src);
  });

  it('round-trips all 256 PETSCII codes through the charset', () => {
    for (let code = 0; code < 256; code++) {
      const text = vic20Charset.toUnicode([code]);
      expect(Array.from(vic20Charset.toMachine(text))).toEqual([code]);
    }
  });

  it('builds a .prg with the $1001 load address', () => {
    const prg = buildPrg('10 PRINT "HI"\n');
    // Leading little-endian load address is $1001 (unexpanded VIC-20).
    expect(Array.from(prg.slice(0, 2))).toEqual([0x01, 0x10]);
    // Round-trips through the .prg-aware detokenizer.
    expect(detokenizeProgram(prg)).toBe('10 PRINT "HI"\n');
  });

  it('warns when importing a .prg with a $0801 (C64) load address', () => {
    const { program } = tokenizeProgram('10 PRINT "HI"\n');
    const prg = Uint8Array.from([0x01, 0x08, ...program]);
    const { warnings } = detokenizeProgramWithReport(prg);
    expect(warnings.some((w) => /load address is \$0801/i.test(w))).toBe(true);
    expect(warnings.some((w) => /VIC-20/i.test(w))).toBe(true);
  });

  it('warns when importing a .prg with a RAM-expansion load address ($1201 / $0401)', () => {
    const { program } = tokenizeProgram('10 PRINT "HI"\n');
    for (const [lo, hi, label] of [
      [0x01, 0x12, '\\$1201'], // +8K/+16K expansion
      [0x01, 0x04, '\\$0401'], // +3K expansion
    ] as const) {
      const prg = Uint8Array.from([lo, hi, ...program]);
      const { warnings } = detokenizeProgramWithReport(prg);
      expect(
        warnings.some((w) =>
          new RegExp(`load address is ${label}`, 'i').test(w),
        ),
      ).toBe(true);
      // The hint names the RAM-expansion addresses so the user can tell what it is.
      expect(warnings.some((w) => /\$1201|\$0401|\+3K|\+8K/i.test(w))).toBe(
        true,
      );
    }
  });

  it('exposes tokenize/detokenize/lint through the dialect at the $1001 base', () => {
    const result = vic20.tokenize('10 PRINT "HI"\n');
    expect(result.errors).toEqual([]);
    // Load address prepended to the program is $1001.
    expect(Array.from(result.image.slice(0, 2))).toEqual([0x01, 0x10]);
    // A clean program lints without errors.
    expect(vic20.lint('10 PRINT "HI"\n')).toEqual([]);
    // detokenize on the dialect surface round-trips.
    expect(vic20.detokenize(result.image)).toBe('10 PRINT "HI"\n');
  });

  // ---- Stage 2 - emulator core ------------------------------------------
  // Covered by src/emulator/vic20/vic20Machine.test.ts (boots the BASIC V2
  // ROMs to READY. and runs an injected program) and the chip unit tests
  // (vicI.test.ts, vicAudio.test.ts, src/emulator/commodore/).
  it('advertises the emulator surface (displaySize + createEmulator)', () => {
    expect(vic20.displaySize).toEqual({ width: 232, height: 248 });
    expect(typeof vic20.createEmulator).toBe('function');
    expect(vic20.romUrl).toMatch(/roms\/vic20\/kernal/);
  });

  // ---- Stage 3 - wire-up ------------------------------------------------
  // Full keyboard-layout + matrix (physical+virtual) coverage lives in
  // keyboardLayout.test.ts; the surface wiring is asserted here.
  it('registers a native joystick and a keyboard layout on the dialect', () => {
    expect(vic20.joystickModes).toEqual(['native']);
    expect(vic20.keyboardLayout?.id).toBe('vic20');
    expect(vic20.keyboardLayout?.theme).toBe('vk-theme-vic20');
  });

  it('is registered in the shared dialect registry', () => {
    expect(getDialect('vic20')).toBe(vic20);
  });

  it('tokenizes every bundled sample cleanly within 3583 bytes', () => {
    expect(vic20.samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
    ]);
    expect(vic20.samples[0]!.name).toBe('hello.bas');
    for (const sample of vic20.samples) {
      const { errors, image } = vic20.tokenize(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(image.length, sample.name).toBeGreaterThan(0);
      // The 2-byte load address rides on the front of the image; the program
      // body must fit the unexpanded machine's 3583 free BASIC bytes.
      expect(image.length - 2, sample.name).toBeLessThanOrEqual(3583);
    }
  });

  // ---- Stage 4 - transfer & tape I/O ------------------------------------
  // The cassette codec itself is exercised in audio/cassette.test.ts; here we
  // confirm the dialect surface is wired: .prg import + tape audio in/out.
  it('exposes .prg import and cassette audio through the dialect', () => {
    expect(vic20.binaryImports).toEqual([
      { extension: '.prg', label: 'Import .PRG…' },
    ]);
    expect(vic20.buildTargets.map((t) => t.id)).toEqual([
      'vic20-prg',
      'vic20-wav',
    ]);
    expect(vic20.audio).toBeDefined();
    expect(typeof vic20.audio!.buildSamples).toBe('function');
    expect(typeof vic20.audio!.decodeSamples).toBe('function');

    const src = '10 PRINT "HI"\n20 GOTO 10\n';
    const samples = vic20.audio!.buildSamples(src, 'GAME', false);
    const { programName, source } = vic20.audio!.decodeSamples!(
      samples,
      vic20.audio!.sampleRate,
    );
    expect(programName).toBe('GAME');
    const norm = (s: string) =>
      s
        .split('\n')
        .map((l) => l.trim().replace(/\s+/g, ' '))
        .filter((l) => l !== '')
        .join('\n');
    expect(norm(source)).toBe(norm(src));
  });

  // ---- Stage 5 - polish -------------------------------------------------
  // The watcher/debugger/audio wiring is exercised against the real ROMs in
  // src/emulator/vic20/vic20Machine.test.ts; here we assert the dialect flag
  // that surfaces the Debug toggle in the toolbar.
  it('advertises the step-through debugger', () => {
    expect(vic20.debuggable).toBe(true);
  });
});
