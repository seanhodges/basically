import * as sv from './sysvars';

export interface ParsedOFile {
  program: Uint8Array;
  vars: number;
  eLine: number;
}

/**
 * Wrap a tokenized program area into a complete ZX80 `.O` image: a straight RAM
 * dump from 0x4000 (the start of the 40-byte system-variable block) up to the
 * byte before E_LINE — exactly what the ROM's SAVE writes and LOAD reads back
 * (the loader fills RAM from 0x4000 until HL reaches the freshly loaded E_LINE).
 *
 * Layout: system variables | program | 0x80 variables-end marker. The edit line
 * and display file are NOT part of the image; the ROM rebuilds them on load.
 *
 * The system-variable values were captured from the real ROM on an empty
 * machine and have their pointers recomputed for the program length here.
 */
export function buildOFile(programBytes: Uint8Array): Uint8Array {
  const progLen = programBytes.length;
  const vars = sv.PROGRAM_BASE + progLen; // holds the 0x80 end marker
  const eLine = vars + 1;
  const dFile = eLine + 2; // after the rebuilt edit line ([cursor][NEWLINE])

  // Image runs 0x4000 .. E_LINE-1 inclusive (i.e. up to and including the
  // 0x80 variables marker at VARS).
  const total = eLine - sv.SYSVARS_BASE;
  const image = new Uint8Array(total);

  const poke = (addr: number, value: number) => {
    image[addr - sv.SYSVARS_BASE] = value & 0xff;
  };
  const pokeWord = (addr: number, value: number) => {
    poke(addr, value & 0xff);
    poke(addr + 1, (value >> 8) & 0xff);
  };

  poke(sv.FLAGS, 0x04);
  pokeWord(sv.SV_4004, eLine);
  pokeWord(sv.VARS, vars);
  pokeWord(sv.E_LINE, eLine);
  pokeWord(sv.D_FILE, dFile);
  pokeWord(sv.DF_END, dFile + 23);
  pokeWord(sv.DF_EA, dFile + 26);
  poke(0x4012, 0x02);
  poke(0x401e, 0xbf);
  poke(0x4023, 0x38);
  poke(0x4024, 0x21);
  poke(0x4025, 0x17);
  poke(0x4026, 0xff);
  poke(0x4027, 0xff);

  image.set(programBytes, sv.PROGRAM_BASE - sv.SYSVARS_BASE);
  image[vars - sv.SYSVARS_BASE] = 0x80; // variables-area end marker

  return image;
}

/** Extract the tokenized program area (and key pointers) from a `.O` image. */
export function parseOFile(image: Uint8Array): ParsedOFile {
  if (image.length < sv.SYSVARS_LENGTH + 1) {
    throw new Error('Not a .O file: too short');
  }
  const word = (addr: number) =>
    image[addr - sv.SYSVARS_BASE]! | (image[addr - sv.SYSVARS_BASE + 1]! << 8);

  const vars = word(sv.VARS);
  const eLine = word(sv.E_LINE);
  if (
    vars < sv.PROGRAM_BASE ||
    eLine < vars ||
    vars - sv.SYSVARS_BASE >= image.length
  ) {
    throw new Error('Not a valid .O file: inconsistent system variables');
  }
  return {
    program: image.slice(
      sv.PROGRAM_BASE - sv.SYSVARS_BASE,
      vars - sv.SYSVARS_BASE,
    ),
    vars,
    eLine,
  };
}
