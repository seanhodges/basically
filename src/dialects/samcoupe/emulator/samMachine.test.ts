import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SamMachine } from './samMachine';
import { tokenizeProgram } from '../tokenizer';
import { buildSamFile } from '../samfile';
import { NVARS, PROG } from '../sysvars';

const ROM = new Uint8Array(
  readFileSync(path.resolve(__dirname, '../../../../public/roms/samcoupe.rom')),
);

/** Frames a short program is given to run to its end after the load. */
const RUN_FRAMES = 40;
/** Frames a keystroke is held, and the frames after it the ROM needs to see it. */
const KEY_FRAMES = 3;

function screen(machine: SamMachine): string[] {
  return (machine.readScreenText()?.lines ?? []).map((l) => l.trimEnd());
}

/** Press and release one key chord, giving the ROM's scan time to see both. */
function tap(machine: SamMachine, chord: string[]): void {
  for (const token of chord) machine.setKey(token, true);
  for (let i = 0; i < KEY_FRAMES; i++) machine.runFrame();
  for (const token of chord) machine.setKey(token, false);
  for (let i = 0; i < KEY_FRAMES; i++) machine.runFrame();
}

/**
 * The keys the test types. The SAM's punctuation is not the host's: `"` and `=`
 * are unshifted keys of their own, and `*` is SHIFT with the `+` key.
 */
const CHORDS: Record<string, string[]> = {
  ' ': ['Space'],
  '"': ['Quote'],
  '=': ['Equal'],
  '*': ['ShiftLeft', 'Plus'],
};

/** Type a line at the editor and submit it. */
function typeLine(machine: SamMachine, text: string): void {
  for (const ch of text) {
    const chord =
      CHORDS[ch] ?? (/[0-9]/.test(ch) ? [`Digit${ch}`] : [`Key${ch}`]);
    tap(machine, chord);
  }
  tap(machine, ['Enter']);
  for (let i = 0; i < 10; i++) machine.runFrame();
}

/** The stored program area, PROG up to the end-of-program byte at NVARS. */
function programArea(machine: SamMachine): number[] {
  const sysvar = (addr: number) => machine.mem.pageByte(0, addr - 0x4000);
  const far = (addr: number) => ({
    page: sysvar(addr),
    offset: (sysvar(addr + 2) << 8) | sysvar(addr + 1),
  });
  const from = far(PROG);
  const to = far(NVARS);
  const length =
    to.page * 0x4000 +
    (to.offset & 0x3fff) -
    (from.page * 0x4000 + (from.offset & 0x3fff));
  const out: number[] = [];
  let { page, offset } = from;
  for (let i = 0; i < length; i++) {
    out.push(machine.mem.pageByte(page, offset & 0x3fff));
    offset++;
    if ((offset & 0x3fff) === 0) page++;
  }
  return out;
}

describe('samcoupe machine', () => {
  it('boots the ROM to the SAM BASIC prompt', () => {
    const machine = new SamMachine({ rom: ROM });
    machine.bootToReady();
    // MODE 4 with a 32x21 grid of nine-scanline cells is where the ROM leaves
    // the machine; every headless check that reads this screen back as text
    // depends on that grid.
    expect(machine.video.mode).toBe(4);
    const text = machine.readScreenText();
    expect(text).not.toBeNull();
    expect(text!.cols).toBe(32);
    expect(text!.rows).toBe(21);
    // A booted machine answers a direct command, which is the real proof that
    // the interpreter is running rather than merely that pixels appeared.
    typeLine(machine, 'PRINT 6');
    expect(screen(machine)[0]).toBe('6');
    expect(screen(machine).at(-1)).toMatch(/^0 OK/);
    machine.dispose();
  });

  it('runs an injected program and shows its output', () => {
    const machine = new SamMachine({ rom: ROM });
    const source = '10 PRINT "HELLO SAM"\n20 PRINT 6*7';
    const { bytes } = tokenizeProgram(source);
    machine.loadProgram(buildSamFile(bytes, 'demo'));
    for (let i = 0; i < RUN_FRAMES; i++) machine.runFrame();
    const lines = screen(machine).filter((l) => l !== '');
    expect(lines).toEqual(['HELLO SAM', '42', '0 OK, 20:1']);
    // The run latch: the program was handed over, ran, and reached the ROM's
    // editor loop again.
    expect(machine.isProgramRunning()).toBe(false);
    expect(machine.currentLine()).toBe(20);
    machine.dispose();
  });

  it('measures the line it is executing on the plain run path', () => {
    const machine = new SamMachine({ rom: ROM });
    // A loop long enough to still be running after the load returns, so the
    // measurement covers a program the machine is actually executing.
    const source =
      '10 FOR I=1 TO 20000\n20 LET J=I\n30 NEXT I\n40 PRINT "DONE"';
    machine.loadProgram(buildSamFile(tokenizeProgram(source).bytes, 'loop'));
    expect(machine.isProgramRunning()).toBe(true);

    // Recording is armed for the life of a run and drained by whoever armed
    // it. The charge is paid on this path, not only inside a debug session: a
    // run the IDE performs to check an assistant answer opens no debugger.
    machine.setProfileRecording(true);
    for (let i = 0; i < 6; i++) machine.runFrame();
    const costs = machine.drainProfile();
    expect(costs).not.toBeNull();
    expect(costs!.find((c) => c.line === 20)?.cost).toBeGreaterThan(0);

    // The debug slice is the same walk over the same budget: stepping from the
    // line the loop is on stops as soon as execution reaches a different one.
    const from = machine.currentLine();
    const result = machine.debugStep({
      mode: 'step',
      fromLine: from,
      breakpoints: new Set(),
    });
    expect(result.paused).toBe(true);
    expect(result.line).not.toBe(from);
    machine.dispose();
  });

  it('tokenizes a listing at the keyboard identically to tokenize()', () => {
    const machine = new SamMachine({ rom: ROM });
    machine.bootToReady();
    // Two lines the tokenizer has real work to do on: a keyword whose token
    // byte comes off the ROM's own table, a string, and the hidden five-byte
    // numeric forms the interpreter inserts after each printed number.
    // CAPS first: the editor types lower case without it, and the case of a
    // string body and a variable name is stored as typed.
    tap(machine, ['CapsLock']);
    const source = '10 PRINT "HI"\n20 LET A=6*7';
    for (const line of source.split('\n')) typeLine(machine, line);
    expect(programArea(machine)).toEqual([
      ...tokenizeProgram(source).bytes,
      0xff, // the ROM's own end-of-program byte
    ]);
    machine.dispose();
  });
});
