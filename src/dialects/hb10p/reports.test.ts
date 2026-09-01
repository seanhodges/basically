import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MSX_ERROR_MESSAGES, readReport } from './reports';
import {
  ERRFLG,
  ERRLIN,
  OLDLIN,
  OLDTXT,
  type MsxMemPort,
} from '../../emulator/msx/workspace';

/**
 * The message table against the ROM that prints it, and the break/Ok decision
 * against hand-built program text. The live check that the cells named here are
 * the ones the interpreter actually writes is in
 * src/emulator/msx/introspection.test.ts.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/msx/hb10p.rom');

/** Where MSX BASIC's error messages start in the BASIC ROM half of the image. */
const MESSAGE_TABLE = 0x3d76;

const TOK_END = 0x81;
const TOK_STOP = 0x90;

function makeMem(): { ram: Uint8Array; port: MsxMemPort } {
  const ram = new Uint8Array(0x10000);
  return {
    ram,
    port: {
      peek: (addr) => ram[addr & 0xffff]!,
      peekWord: (addr) =>
        ram[addr & 0xffff]! | (ram[(addr + 1) & 0xffff]! << 8),
    },
  };
}

/** Set a little-endian word. */
function setWord(ram: Uint8Array, addr: number, value: number): void {
  ram[addr] = value & 0xff;
  ram[addr + 1] = (value >> 8) & 0xff;
}

describe('hb10p report reader', () => {
  // The ROM keeps the messages as consecutive NUL-terminated strings from code
  // 1, so the table can be walked and compared character for character rather
  // than trusted. Skipped where the removable image is absent.
  it.skipIf(!existsSync(ROM_PATH))(
    'spells every error the way the ROM prints it',
    () => {
      const rom = new Uint8Array(readFileSync(ROM_PATH));
      let at = MESSAGE_TABLE;
      const printed: string[] = [];
      while (printed.length < 35) {
        let text = '';
        while (rom[at] !== 0) text += String.fromCharCode(rom[at++]!);
        at++;
        printed.push(text);
      }
      // Codes 1-25 are the interpreter's own; 50 upwards are the disc errors,
      // numbered from 50 whether or not the machine has a drive.
      const codes = [
        ...Array.from({ length: 25 }, (_, i) => i + 1),
        ...Array.from({ length: 10 }, (_, i) => i + 50),
      ];
      expect(codes.map((code) => MSX_ERROR_MESSAGES[code])).toEqual(printed);
    },
  );

  it('reports an error with the code and line the interpreter left', () => {
    const { ram, port } = makeMem();
    ram[ERRFLG] = 9;
    setWord(ram, ERRLIN, 240);
    expect(readReport(port)).toEqual({
      isError: true,
      message: 'Subscript out of range',
      code: '9',
      line: 240,
    });
  });

  it('is Ok at the prompt and after a program that ended', () => {
    const { ram, port } = makeMem();
    // Nothing has run: there is no resume point.
    expect(readReport(port)).toEqual({ isError: false, message: 'Ok' });

    // END: the resume point sits just past the END token.
    ram[0x8010] = TOK_END;
    setWord(ram, OLDTXT, 0x8011);
    setWord(ram, OLDLIN, 30);
    expect(readReport(port)).toEqual({ isError: false, message: 'Ok' });

    // Ran off the last line: the resume point is followed by the zero link
    // that ends the program rather than by another line.
    ram[0x8010] = 0x41;
    setWord(ram, 0x8012, 0x0000);
    expect(readReport(port)).toEqual({ isError: false, message: 'Ok' });
  });

  it('reports a break at a STOP and at an interrupted line', () => {
    const { ram, port } = makeMem();
    setWord(ram, OLDLIN, 40);

    // STOP, even as the program's very last statement.
    ram[0x8010] = TOK_STOP;
    setWord(ram, OLDTXT, 0x8011);
    setWord(ram, 0x8012, 0x0000);
    expect(readReport(port)).toEqual({
      isError: false,
      message: 'Break in 40',
      line: 40,
    });

    // CTRL-STOP mid-program: an ordinary token behind the resume point, and a
    // link to a further line ahead of it.
    ram[0x8010] = 0x41;
    setWord(ram, 0x8012, 0x8020);
    expect(readReport(port)).toEqual({
      isError: false,
      message: 'Break in 40',
      line: 40,
    });
  });

  it('lets an error outrank a resumable break', () => {
    // Both are recorded at once - an error leaves OLDTXT set as well - and the
    // error is what the IDE offers to fix.
    const { ram, port } = makeMem();
    ram[ERRFLG] = 2;
    setWord(ram, ERRLIN, 10);
    ram[0x8010] = 0x41;
    setWord(ram, OLDTXT, 0x8011);
    setWord(ram, OLDLIN, 10);
    setWord(ram, 0x8012, 0x8020);
    expect(readReport(port)?.message).toBe('Syntax error');
  });
});
