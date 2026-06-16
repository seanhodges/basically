import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { bbcSamples } from './samples';
import { bbcmicro } from './index';
import { tokenizeProgram } from './tokenizer';
import {
  BbcMachine,
  configureNodeRomPath,
} from '../../emulator/bbc/bbcMachine';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** Mode-7 screen RAM (0x7C00–0x7FFF) as a string of printable characters. */
function screenText(machine: BbcMachine): string {
  let text = '';
  for (let addr = 0x7c00; addr < 0x8000; addr++) {
    const b = machine.processor.readmem(addr);
    text += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ' ';
  }
  return text;
}

async function runUntil(
  machine: BbcMachine,
  predicate: () => boolean,
  maxFrames = 500,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

describe('bbcmicro sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of bbcSamples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('matches the canonical sample set shared with the other dialects', () => {
    expect(bbcSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
    ]);
  });

  it('hello is the starter offered for a fresh document', () => {
    expect(bbcmicro.samples[0]!.name).toBe('hello.bas');
  });

  it('breakout destroys blocks when the ball reaches them', async () => {
    const breakout = bbcSamples.find((s) => s.name === 'breakout.bas')!;
    const { bytes } = tokenizeProgram(breakout.text);
    const machine = new BbcMachine();
    machine.loadProgram(bytes);
    // The only place the program raises the score is PROChit, which also erases
    // the struck block and clears it from B%() — so a non-zero S% proves blocks
    // are being destroyed. S% is the resident integer at &44C (&400 + 19*4).
    const readScore = () => {
      const m = machine.processor;
      return (
        m.readmem(0x44c) |
        (m.readmem(0x44d) << 8) |
        (m.readmem(0x44e) << 16) |
        (m.readmem(0x44f) << 24)
      );
    };
    const scored = await runUntil(machine, () => readScore() > 0, 2000);
    expect(scored, `score stayed at ${readScore()}`).toBe(true);
    machine.dispose();
  }, 60000);

  it('the mode-7 maze draws its walls as teletext block graphics', async () => {
    const maze = bbcSamples.find((s) => s.name === 'maze.bas')!;
    const { bytes } = tokenizeProgram(maze.text);
    const machine = new BbcMachine();
    machine.loadProgram(bytes);
    // The maze prints a 9-row wall map, then the "REACH E TO WIN" prompt on the
    // line below it — so the prompt only appears once every wall row is drawn.
    const drawn = await runUntil(machine, () =>
      screenText(machine).includes('REACH E TO WIN'),
    );
    expect(drawn).toBe(true);
    // Walls are solid 2x3 sixel blocks: CHR$(255). The flashing exit uses the
    // teletext flash control CHR$(136). Count both in screen RAM.
    let blocks = 0;
    let flash = 0;
    for (let addr = 0x7c00; addr < 0x8000; addr++) {
      const b = machine.processor.readmem(addr);
      if (b === 0xff) blocks++;
      if (b === 136) flash++;
    }
    expect(blocks).toBeGreaterThan(40);
    expect(flash).toBeGreaterThan(0);

    // The player is drawn one line below the prompts (line 160), so wait for it.
    // It is no longer a colour-switched solid block but an animated zig-zag sixel
    // sprite — frame 0 = CHR$(185) (0xB9), frame 1 = CHR$(230) (0xE6) — that
    // inherits the walls' graphics-cyan colour. So it must NOT emit the old
    // graphics-yellow control CHR$(147).
    const hasSprite = () => {
      for (let addr = 0x7c00; addr < 0x8000; addr++) {
        const b = machine.processor.readmem(addr);
        if (b === 0xb9 || b === 0xe6) return true;
      }
      return false;
    };
    expect(await runUntil(machine, hasSprite)).toBe(true);
    let yellow = 0;
    for (let addr = 0x7c00; addr < 0x8000; addr++) {
      if (machine.processor.readmem(addr) === 147) yellow++;
    }
    expect(yellow).toBe(0);
    machine.dispose();
  }, 60000);
});
