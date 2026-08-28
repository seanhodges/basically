import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AtariMachine } from './atariMachine';
import { ATARI_DISPLAY_HEIGHT, ATARI_DISPLAY_WIDTH } from './gtia';
import { ATARI_PALETTE } from './palette';
import { atari800 } from '../../dialects/atari800/index';
import { atari400 } from '../../dialects/atari400/index';
import { fitRomImage } from '../../app/romImage';
import { ATARI_ROM_BYTES } from '../../dialects/atari800/addresses';

/**
 * The machine against the firmware it actually runs.
 *
 * Everything here boots the committed image and reads the result back off the
 * screen, because that is the only check that says the chips are right: a
 * display list the OS wrote, drawn by ANTIC, coloured by GTIA and decoded
 * through the dialect's own character set is four modules agreeing, and none of
 * them can be talked into agreeing by a table.
 *
 * Booting takes a second of emulated time - nearly all of it the OS asking an
 * empty serial bus for a disk to boot - so the cases are grouped into as few
 * journeys as they can be.
 */

const ROM = new Uint8Array(readFileSync('public/roms/atari.rom'));

/** Frames a program is given to start, run and finish. */
const RUN_FRAMES = 300;

function machine(model: '400' | '800' = '800'): AtariMachine {
  return new AtariMachine({ model, rom: ROM });
}

/** Load a program and run it to a standstill, or to the cap. */
function run(source: string, model: '400' | '800' = '800'): AtariMachine {
  const m = machine(model);
  const { image, errors } = atari800.tokenize(source);
  expect(errors, 'the probe should tokenize cleanly').toEqual([]);
  m.loadProgram(image);
  let started = false;
  for (let frame = 0; frame < RUN_FRAMES; frame++) {
    m.runFrame();
    const running = m.isProgramRunning();
    if (running === true) started = true;
    if (started && running === false) break;
  }
  return m;
}

/** The whole screen as one string. */
const screen = (m: AtariMachine): string =>
  (m.readScreenText()?.lines ?? []).join('\n');

/** How many pixels of each colour the last frame painted. */
function histogram(m: AtariMachine): Map<string, number> {
  const rgba = (m as unknown as { antic: { rgba: Uint8ClampedArray } }).antic
    .rgba;
  const counts = new Map<string, number>();
  for (let i = 0; i < ATARI_DISPLAY_WIDTH * ATARI_DISPLAY_HEIGHT * 4; i += 4) {
    const key = `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const colour = (byte: number): string => {
  const [r, g, b] = ATARI_PALETTE[byte]!;
  return `${r},${g},${b}`;
};

describe('the Atari machine on its own ROM', () => {
  it('boots the cartridge and reaches the BASIC prompt', () => {
    const m = machine();
    let booted = false;
    for (let frame = 0; frame < 400 && !booted; frame++) {
      m.runFrame();
      booted = /READY/i.test(screen(m));
    }
    expect(booted, 'BASIC should sign on and prompt').toBe(true);
    // Signed on by name, so a wrong or truncated cartridge cannot pass.
    expect(screen(m)).toContain('BASIC');

    // And the prompt is drawn in the colours the OS opens GRAPHICS 0 in: light
    // blue text on the darker blue paper, inside a black border.
    const painted = histogram(m);
    expect(painted.get(colour(0x94))).toBeGreaterThan(40_000); // the paper
    expect(painted.get(colour(0x9a))).toBeGreaterThan(100); // the text
    expect(painted.get(colour(0x00))).toBeGreaterThan(10_000); // the border
    m.dispose();
  });

  it('gets past the boot request for a disk without waiting it out', () => {
    // The cartridge header says a disk may boot ahead of it, so every power-on
    // asks D1: for its status. The drive on the bus answers "no disk" at the
    // first attempt (see ./sio); an unanswered bus would have to be discovered
    // by timing out twenty-eight times, which is most of a second the user pays
    // on the front of every run.
    const m = machine();
    let frames = 0;
    while (frames < 400 && !/READY/i.test(screen(m))) {
      m.runFrame();
      frames++;
    }
    expect(frames).toBeLessThan(30);
    m.dispose();
  });

  it('runs an injected program and prints what it should', () => {
    const m = run(
      '10 PRINT "HELLO ATARI"\n' +
        '20 FOR I=1 TO 3\n' +
        '30 PRINT "LINE ";I\n' +
        '40 NEXT I\n',
    );
    const text = screen(m);
    expect(text).toContain('HELLO ATARI');
    expect(text).toContain('LINE 1');
    expect(text).toContain('LINE 3');
    m.dispose();
  });

  it('reports a run starting and finishing', () => {
    const m = machine();
    m.loadProgram(atari800.tokenize('10 FOR I=1 TO 400\n20 NEXT I\n').image);
    const seen: (boolean | null)[] = [];
    for (let frame = 0; frame < RUN_FRAMES; frame++) {
      m.runFrame();
      seen.push(m.isProgramRunning());
      if (seen.length > 2 && seen.at(-1) === false && seen.includes(true))
        break;
    }
    expect(seen).toContain(true);
    expect(seen.at(-1)).toBe(false);
    // Nothing goes back to running once the latch has said the run is over.
    for (let frame = 0; frame < 20; frame++) m.runFrame();
    expect(m.isProgramRunning()).toBe(false);
    m.dispose();
  });

  it('calls a program that ends with STOP or an error finished too', () => {
    for (const source of [
      '10 PRINT "A"\n20 FOR I=1 TO 200:NEXT I\n30 STOP\n',
      '10 FOR I=1 TO 200:NEXT I\n20 PRINT 1/0\n',
    ]) {
      const m = run(source);
      expect(m.isProgramRunning(), source).toBe(false);
      m.dispose();
    }
  });

  it('keeps a program waiting at INPUT counted as running', () => {
    const m = machine();
    m.loadProgram(
      atari800.tokenize('10 DIM A$(9)\n20 INPUT A$\n30 PRINT "GOT ";A$\n')
        .image,
    );
    for (let frame = 0; frame < 120; frame++) m.runFrame();
    expect(m.isProgramRunning()).toBe(true);
    m.type('HI\n');
    for (let frame = 0; frame < 120; frame++) m.runFrame();
    expect(m.isProgramRunning()).toBe(false);
    expect(screen(m)).toContain('GOT HI');
    m.dispose();
  });

  it('draws the graphics modes a program asks for', () => {
    // GRAPHICS 8 is one bit a pixel over a 320-wide playfield: the drawn line
    // should light a few thousand of them and nothing else.
    const hires = run(
      '10 GRAPHICS 8\n' +
        '20 COLOR 1\n' +
        '30 FOR X=0 TO 300 STEP 4\n' +
        '40 PLOT X,0:DRAWTO 159,95\n' +
        '50 NEXT X\n',
    );
    expect(histogram(hires).get(colour(0x9a))).toBeGreaterThan(2000);
    hires.dispose();

    // GRAPHICS 7 is two bits a pixel over three drawable colour registers, so
    // three colours the mode did not start with should appear.
    const colourful = run(
      '10 GRAPHICS 7\n' +
        '20 FOR C=1 TO 3\n' +
        '30 COLOR C\n' +
        '40 PLOT 0,C*10:DRAWTO 159,C*10+20\n' +
        '50 NEXT C\n',
    );
    // COLOR 1 and COLOR 2 are COLPF0 and COLPF1, which the OS opens the mode
    // with as gold and green. (COLOR 3 is COLPF2, which is also the paper of
    // the text window at the foot of the screen, so it is not its own colour in
    // a histogram of the whole frame.)
    const painted = histogram(colourful);
    for (const register of [0x28, 0xca]) {
      expect(
        painted.get(colour(register)),
        `COLPF register $${register.toString(16)}`,
      ).toBeGreaterThan(600);
    }
    colourful.dispose();
  });

  it('reads back the text window a graphics mode leaves at its foot', () => {
    const m = run('10 GRAPHICS 5\n20 PRINT "IN THE WINDOW"\n');
    const text = m.readScreenText();
    expect(text?.rows).toBe(4);
    expect(text?.lines.join('\n')).toContain('IN THE WINDOW');
    m.dispose();
  });

  it('gives the 400 the RAM a 400 had, and the 800 the RAM an 800 had', () => {
    const small = run('10 PRINT FRE(0)\n', '400');
    const big = run('10 PRINT FRE(0)\n', '800');
    const freeOn = (m: AtariMachine): number =>
      Number(/\b(\d{4,5})\b/.exec(screen(m))?.[1] ?? 0);

    // A 16K 400 leaves BASIC around 13K and a 48K 800 around 37K, both of them
    // short of the fitted total: the OS's own workspace and the screen come off
    // the top, and on the 800 the cartridge covers the RAM behind $A000.
    expect(freeOn(small)).toBeGreaterThan(12_000);
    expect(freeOn(small)).toBeLessThan(14_000);
    expect(freeOn(big)).toBeGreaterThan(36_000);
    expect(freeOn(big)).toBeLessThan(38_000);
    // Which is close to what each dialect promises before anything has booted.
    expect(atari400.programRamBytes).toBeGreaterThan(freeOn(small) - 500);
    expect(atari800.programRamBytes).toBeGreaterThan(freeOn(big) - 500);
    small.dispose();
    big.dispose();
  });

  it('charges each BASIC line what it cost, and records what it touched', () => {
    const m = machine();
    m.loadProgram(
      atari800.tokenize('10 FOR I=1 TO 50\n20 POKE 1536,I\n30 NEXT I\n').image,
    );
    expect(m.drainProfile(), 'nothing is measured unarmed').toBeNull();
    expect(m.drainMemoryActivity()).toBeNull();

    m.setProfileRecording(true);
    m.setMemoryActivityRecording(true);
    for (let frame = 0; frame < 80; frame++) m.runFrame();

    const costs = m.drainProfile();
    expect(costs).not.toBeNull();
    expect(new Set(costs!.map((c) => c.line))).toEqual(new Set([10, 20, 30]));
    expect(costs!.every((c) => c.cost > 0)).toBe(true);

    const hits = m.drainMemoryActivity();
    expect(hits).not.toBeNull();
    expect(hits!.length).toBe(0x10000);
    // Bit 0 is a read and bit 1 a write, and the program did both to 1536.
    expect(hits![0x600]).toBe(0b11);

    m.setProfileRecording(false);
    m.setMemoryActivityRecording(false);
    expect(m.drainProfile()).toBeNull();
    expect(m.drainMemoryActivity()).toBeNull();
    m.dispose();
  });

  it('steps the debugger over the same walk the run loop takes', () => {
    const m = machine();
    // Long enough that it is still going when the debugger takes over: a
    // thousand iterations is about a second of this machine's time.
    m.loadProgram(atari800.tokenize('10 FOR I=1 TO 20000\n20 NEXT I\n').image);
    for (let frame = 0; frame < 40; frame++) m.runFrame();
    expect(m.currentLine()).not.toBeNull();

    const from = m.currentLine();
    const stepped = m.debugStep({
      breakpoints: new Set<number>(),
      mode: 'step',
      fromLine: from,
    });
    expect(stepped.paused).toBe(true);
    expect(stepped.line).not.toBe(from);

    // And a breakpoint stops on the line it names.
    const hit = m.debugStep({
      breakpoints: new Set([10]),
      mode: 'run',
      fromLine: stepped.line,
    });
    expect(hit.paused).toBe(true);
    expect(hit.line).toBe(10);
    m.dispose();
  });

  it('constructs, and says so on screen, with no ROM installed', () => {
    const m = new AtariMachine({ model: '800', rom: new Uint8Array(0) });
    expect(() => m.runFrame()).not.toThrow();
    expect(m.isProgramRunning()).toBeNull();
    expect(m.readScreenText()).toBeNull();
    m.dispose();
  });

  it('boots an image the seam padded to the ROM area', () => {
    // A user's own image is fitted before the machine sees it. An OS with no
    // cartridge behind it pads to an all-$FF cartridge window, which the OS
    // reads as an empty slot - so the machine still boots, to the Memo Pad
    // rather than to BASIC.
    const osOnly = fitRomImage(ROM.subarray(0, 0x2800), ATARI_ROM_BYTES);
    const m = new AtariMachine({ model: '800', rom: osOnly });
    for (let frame = 0; frame < 200; frame++) m.runFrame();
    const text = screen(m);
    expect(text).not.toContain('BASIC');
    expect(text.trim().length).toBeGreaterThan(0);
    m.dispose();
  });
});
