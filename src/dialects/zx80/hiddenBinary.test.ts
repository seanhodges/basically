// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { zx80 } from './index';
import { buildOFile } from './ofile';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgramWithInfo, structuralWarnings } from './detokenizer';
import { importRoundTrip, firstDifference } from '../roundTripHarness';
import { formatBinaryDirective } from '../binaryDirective';

/**
 * The hidden-machine-code trick on the ZX80: code stashed in REM lines that a
 * listing cannot show - line number 0, duplicated line numbers, giant
 * mostly-non-printable REM bodies. ZX80 records are NEWLINE-delimited (no
 * length field), so unlike the ZX81 a body can never embed a stray 0x76, and
 * the machine code itself must avoid that byte; the record shape is simply
 * `u16 BE line number + body + 0x76`.
 */

const NEWLINE = 0x76;
const REM = 0xfe;

/** Assemble a raw ZX80 line record (no length field). */
function record(no: number, body: number[], terminated = true): number[] {
  return [
    (no >> 8) & 0xff,
    no & 0xff,
    ...body,
    ...(terminated ? [NEWLINE] : []),
  ];
}

/** Machine-code-looking bytes avoiding 0x76 (raw escapes in the charset). */
function machineCode(n: number): number[] {
  const opcodes = [0xcd, 0x21, 0xc9, 0xd5, 0xe5, 0xf1, 0x47, 0x18];
  return Array.from({ length: n }, (_, i) => opcodes[i % opcodes.length]!);
}

describe('zx80 hidden binary lines', () => {
  it('imports a line-0 REM and duplicate line 1s byte-exactly', () => {
    const program = Uint8Array.from([
      ...record(0, [REM, ...machineCode(100)]),
      ...record(1, [REM, ...machineCode(200)]),
      ...record(1, [REM, ...machineCode(200)]),
      ...record(2, [0xf7]), // 2 RUN
      ...record(30, [0xf8]), // 30 STOP
    ]);
    const image = buildOFile(program);

    const outcome = importRoundTrip(zx80, image);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
    expect(outcome.source.match(/^#BIN /gm)?.length).toBe(3);
    expect(outcome.warnings.join(' ')).toMatch(/3 machine-code lines /);
  });

  it('captures a terminator-less final record byte-exactly', () => {
    const program = Uint8Array.from([
      ...record(10, [0xf7]),
      ...record(20, [REM, 0x26, 0x27], false), // tail lost its NEWLINE
    ]);

    expect(structuralWarnings(program)).toEqual([]);
    const { source, binaryLines } = detokenizeProgramWithInfo(program);
    expect(binaryLines).toBe(1);
    const { bytes, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual(Array.from(program));
  });

  it('still warns about a lone trailing byte', () => {
    const program = Uint8Array.from([...record(10, [0xf7]), 0x00]);
    expect(structuralWarnings(program).join(' ')).toMatch(
      /partial line number/,
    );
  });

  it('still rejects a text line at or below a binary line number', () => {
    const bin5 = formatBinaryDirective(Uint8Array.from(record(5, [REM, 0x26])));
    const { errors } = tokenizeProgram(`${bin5}\n5 STOP\n`);
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toMatch(/not greater than previous line 5/);
  });

  it('rejects a record without a line number', () => {
    const { errors } = tokenizeProgram('#BIN AA==\n'); // 1 byte
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toMatch(/too short/);
  });

  it('leaves an empty REM and readable REMs as text', () => {
    const program = Uint8Array.from([
      ...record(10, [REM]), // 10 REM
      ...record(20, [REM, 0x2d, 0x2e]), // 20 REM HI
    ]);
    const { source, binaryLines } = detokenizeProgramWithInfo(program);
    expect(binaryLines).toBe(0);
    expect(source).toBe('10 REM\n20 REM HI\n');
  });

  describe('heuristic policy for well-formed machine-code REMs', () => {
    // Structurally valid: ascending line 1, properly terminated.
    const valid = Uint8Array.from([
      ...record(1, [REM, ...machineCode(100)]),
      ...record(2, [0xf7]),
    ]);

    it('captures a large mostly-non-printable REM by default', () => {
      const { source, binaryLines } = detokenizeProgramWithInfo(valid);
      expect(binaryLines).toBe(1);
      expect(source).toContain('#BIN ');
      const { bytes, errors } = tokenizeProgram(source);
      expect(errors).toEqual([]);
      expect(Array.from(bytes)).toEqual(Array.from(valid));
    });

    it('leaves it as escape text under the strict policy', () => {
      const { source, binaryLines } = detokenizeProgramWithInfo(
        valid,
        'strict',
      );
      expect(binaryLines).toBe(0);
      expect(source).toContain('\\{CD}');
      const { bytes, errors } = tokenizeProgram(source);
      expect(errors).toEqual([]);
      expect(Array.from(bytes)).toEqual(Array.from(valid));
    });

    it('does not capture a REM below the size threshold', () => {
      const small = Uint8Array.from(record(1, [REM, ...machineCode(40)]));
      expect(detokenizeProgramWithInfo(small).binaryLines).toBe(0);
    });
  });

  describe('a REM called via USR is captured whatever its bytes look like', () => {
    // "USR" has no ZX80 token: it is the letters U, S, R, then '(' digits ')'.
    const PRINT = 0xf4;
    const OPEN = 0xda;
    const CLOSE = 0xd9;
    const USR = [0x3a, 0x38, 0x37]; // U, S, R
    const digits = (n: number) =>
      String(n)
        .split('')
        .map((d) => 0x1c + Number(d));
    // A line-1 REM's code starts at PROGRAM_BASE 0x4028 + 3 = 0x402B = 16427.
    const usrCall = (addr: number) =>
      record(2, [PRINT, ...USR, OPEN, ...digits(addr), CLOSE]);

    it('captures a small, mostly-printable code REM (the export→import case)', () => {
      // "HELLO" plus a few opcodes: small and mostly text, so both heuristic
      // gates miss it - only the USR(16427) reference reveals it as code.
      const helloWorld = [0x2d, 0x2a, 0x31, 0x31, 0x34, 0xcd, 0xc9, 0x2f];
      const program = Uint8Array.from([
        ...record(1, [REM, ...helloWorld]),
        ...usrCall(0x402b),
      ]);

      // Without the USR reference the same REM stays text (nothing calls it).
      const orphan = Uint8Array.from(record(1, [REM, ...helloWorld]));
      expect(detokenizeProgramWithInfo(orphan).binaryLines).toBe(0);

      const { source, binaryLines } = detokenizeProgramWithInfo(program);
      expect(binaryLines).toBe(1);
      expect(source).toContain('#BIN ');
      const { bytes, errors } = tokenizeProgram(source);
      expect(errors).toEqual([]);
      expect(Array.from(bytes)).toEqual(Array.from(program));
    });

    it('leaves a readable line-1 REM as text when no USR points at it', () => {
      const program = Uint8Array.from([
        ...record(1, [REM, 0x2d, 0x2a, 0x31, 0x31, 0x34]), // 1 REM HELLO
        ...usrCall(0x8000), // USR of some other address
      ]);
      expect(detokenizeProgramWithInfo(program).binaryLines).toBe(0);
    });

    it('ignores a quoted "USR(16427)" inside a string literal', () => {
      // A PRINT of the literal text must not be mistaken for a real call.
      const QUOTE = 0x01;
      const strChars = [...USR, 0x10, ...digits(16427), 0x11]; // USR(16427)
      const program = Uint8Array.from([
        ...record(1, [REM, 0x2d, 0x2a, 0x31, 0x31, 0x34]), // 1 REM HELLO
        ...record(2, [PRINT, QUOTE, ...strChars, QUOTE]),
      ]);
      expect(detokenizeProgramWithInfo(program).binaryLines).toBe(0);
    });
  });
});
