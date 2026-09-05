import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AtariMachine } from '../../emulator/atari/atariMachine';
import { tokenizeProgram } from './tokenizer';
import { HEADER_BYTES, IMMEDIATE_LINE, parseAtariImage } from './basfile';
import { BASIC_POINTERS } from './addresses';

/**
 * The tokenizer against the interpreter that will read what it writes.
 *
 * Stage by stage the token tables here were written from documentation, and
 * documentation of this machine is not always right: Atari BASIC stores a
 * program pre-parsed, so an image is not just the right tokens but the right
 * variable tables, the right per-statement offsets and the right line records,
 * and any of those can be plausible and wrong. Green tests over a table the
 * same author wrote would not find it.
 *
 * So this test does not compare tables. It types a listing at the emulated
 * keyboard, lets Atari BASIC parse it into memory, reads the machine's own
 * bytes back out, and diffs them against what {@link tokenizeProgram} produces
 * for the same text. Where they agree, the tokenizer is writing what the ROM
 * writes; where they differ, the ROM is right.
 */

const ROM = new Uint8Array(readFileSync('public/roms/atari/atari.rom'));

const { LOMEM, VNTP } = BASIC_POINTERS;

/** Frames a listing is given to be typed in. */
const TYPE_FRAMES = 900;

/**
 * Frames to let the last line land after the last RETURN has been taken.
 * Consuming the key and parsing the line it ended are not the same moment.
 */
const SETTLE_FRAMES = 60;

/**
 * Type `source` at a booted machine and read back the image BASIC built.
 *
 * The result is in the same shape {@link tokenizeProgram} produces - the
 * fourteen header bytes of pointers-from-LOMEM, then the block from VNTP to
 * STARP - so the two can be compared region by region.
 *
 * One pointer is rebuilt rather than read: STMCUR. BASIC moves it when it
 * *executes* a direct-mode line, not when a program line is inserted above it,
 * so at the prompt it can be several lines stale - and it is not a fact about
 * the program in any case, since the immediate line it points at holds whatever
 * the user last typed. Walking the line records to the immediate line finds
 * where the program really ends.
 */
function tokenizedByRom(source: string): Uint8Array {
  const machine = new AtariMachine({ model: '800', rom: ROM });
  try {
    // An empty program, injected, is how the machine gets past its boot and to
    // a prompt with nothing in the way.
    machine.loadProgram(tokenizeProgram('').image);
    // NEW clears out the injected program, so what follows is only what is
    // typed - and typed, not injected, which is the whole point.
    const typed = machine.typeAndRun(`NEW\n${source}`, TYPE_FRAMES);
    expect(typed, 'the machine should consume the whole listing').toBe(true);
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) machine.runFrame();

    const word = (address: number): number =>
      machine.peek(address) | (machine.peek(address + 1) << 8);
    const lomem = word(LOMEM);
    const starp = word(BASIC_POINTERS.STARP);
    const vntp = word(VNTP);

    const image = new Uint8Array(HEADER_BYTES + starp - vntp);
    for (let i = 0; i < 7; i++) {
      const pointer = word(LOMEM + i * 2) - lomem;
      image[i * 2] = pointer & 0xff;
      image[i * 2 + 1] = (pointer >> 8) & 0xff;
    }
    for (let i = 0; vntp + i < starp; i++) {
      image[HEADER_BYTES + i] = machine.peek(vntp + i);
    }

    // Walk the statement table to the immediate line and write that as STMCUR.
    let at = word(BASIC_POINTERS.STMTAB);
    while (at < starp && word(at) < IMMEDIATE_LINE) at += machine.peek(at + 2);
    image[10] = (at - lomem) & 0xff;
    image[11] = ((at - lomem) >> 8) & 0xff;
    return image;
  } finally {
    machine.dispose();
  }
}

/** The bytes between two of the machine's pointers, as an array. */
function region(machineImage: Uint8Array, from: number, to: number): number[] {
  const word = (at: number) => machineImage[at]! | (machineImage[at + 1]! << 8);
  const vntp = word(2);
  const start = HEADER_BYTES + word(from) - vntp;
  const end = HEADER_BYTES + word(to) - vntp;
  return [...machineImage.subarray(start, end)];
}

/** Offsets into the fourteen-byte header of the pointers it holds. */
const HEADER = { vntp: 2, vntd: 4, vvtp: 6, stmtab: 8, stmcur: 10 };

/**
 * Listings chosen to reach the parts of the format a simpler one would not: a
 * variable of each kind, a line with several statements, both constant forms,
 * every arithmetic and comparison operator, a function call, and the control
 * structures whose tokens differ from their statement spellings.
 */
const LISTINGS: Record<string, string> = {
  'a bare print': '10 PRINT "HI"\n',

  'variables of all three kinds': [
    '10 DIM A$(10),B(5)\n',
    '20 LET X=1\n',
    '30 A$="TEXT"\n',
    '40 B(0)=X+1\n',
    '50 PRINT A$;B(0);X\n',
  ].join(''),

  'several statements on one line': '10 X=1:Y=2:PRINT X+Y:REM DONE\n',

  'numbers of every shape': [
    '10 A=0\n',
    '20 B=1\n',
    '30 C=255\n',
    '40 D=32767\n',
    '50 E=0.5\n',
    '60 F=1.25E9\n',
    '70 G=-7\n',
  ].join(''),

  'every operator': [
    '10 A=1+2-3*4/5\n',
    '20 B=2^8\n',
    '30 IF A<B AND B>A THEN PRINT "Y"\n',
    '40 IF A<=B OR A>=B THEN PRINT "N"\n',
    '50 IF A<>B THEN PRINT NOT A\n',
  ].join(''),

  functions: [
    '10 A=ABS(-1)+INT(2.5)+SGN(3)\n',
    '20 B=SQR(4)+SIN(0)+COS(0)+ATN(1)+EXP(1)+LOG(2)\n',
    '30 C=RND(0)+PEEK(1536)\n',
    '40 DIM D$(9)\n',
    '50 D$=STR$(12)\n',
    '60 E=LEN(D$)+VAL(D$)+ASC(D$)\n',
    '70 PRINT CHR$(65)\n',
  ].join(''),

  'control flow': [
    '10 FOR I=1 TO 10 STEP 2\n',
    '20 IF I=5 THEN GOTO 40\n',
    '30 GOSUB 100\n',
    '40 NEXT I\n',
    '50 ON I GOTO 10,20\n',
    '60 TRAP 100\n',
    '70 END\n',
    '100 RETURN\n',
  ].join(''),

  'graphics and sound': [
    '10 GRAPHICS 7\n',
    '20 COLOR 1\n',
    '30 PLOT 0,0\n',
    '40 DRAWTO 100,50\n',
    '50 SETCOLOR 2,9,4\n',
    '60 SOUND 0,121,10,8\n',
    '70 POSITION 2,3\n',
    '80 POKE 752,1\n',
  ].join(''),

  'input and data': [
    '10 DIM A$(9)\n',
    '20 DATA 1,2,3\n',
    '30 READ X,Y,Z\n',
    '40 RESTORE 20\n',
    '50 PRINT X;Y;Z\n',
  ].join(''),
};

describe('the tokenizer against the ROM that reads its output', () => {
  for (const [name, source] of Object.entries(LISTINGS)) {
    it(`writes what Atari BASIC writes for ${name}`, () => {
      const fromRom = tokenizedByRom(source);
      const fromTokenizer = tokenizeProgram(source);
      expect(
        fromTokenizer.errors,
        'the listing should tokenize cleanly',
      ).toEqual([]);
      const ours = fromTokenizer.image;

      // The variable name table: the names, in the order the program first
      // mentions them, each with the top bit set on its last character.
      expect(region(fromRom, HEADER.vntp, HEADER.vntd)).toEqual(
        region(ours, HEADER.vntp, HEADER.vntd),
      );

      // The variable value table: eight bytes an entry, in the same order.
      expect(region(fromRom, HEADER.vvtp, HEADER.stmtab)).toEqual(
        region(ours, HEADER.vvtp, HEADER.stmtab),
      );

      // And the program itself: line numbers, line lengths, the offset in front
      // of every statement, and the tokens between them.
      expect(region(fromRom, HEADER.stmtab, HEADER.stmcur)).toEqual(
        region(ours, HEADER.stmtab, HEADER.stmcur),
      );
    });
  }

  it('reads its own listing back the way the machine holds it', () => {
    // The parser and the machine agree about the shape as well as the bytes.
    const fromRom = tokenizedByRom('10 X=1\n20 PRINT X\n');
    const parsed = parseAtariImage(fromRom);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.variables).toEqual([{ name: 'X', kind: 'number' }]);
    // Only the program: the immediate line past it is the direct-mode buffer,
    // which this reconstruction stops short of (see {@link tokenizedByRom}).
    expect(parsed.lines.map((line) => line.number)).toEqual([10, 20]);
  });
});
