import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KALEIDO_BLOCK, spectrumSamples } from './samples';
import { spectrumMemoryBlocks } from './memoryBlocks';
import { tokenizeProgram } from './tokenizer';
import { buildTap } from './tapfile';
import { SpectrumMachine } from './emulator/spectrumMachine';
import { asmEngineFor } from '../../asm/registry';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/zxspectrum.rom')),
);

describe('zxspectrum sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of spectrumSamples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('the kaleidoscope block assembles clean inside its valid range', () => {
    const engine = asmEngineFor(spectrumMemoryBlocks.cpu)!;
    const result = engine.assemble(
      KALEIDO_BLOCK.asmSource,
      KALEIDO_BLOCK.address,
    );
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors)).toBe(
      true,
    );
    if (!result.ok) return;
    expect(result.bytes.length).toBeGreaterThan(0);
    const end = KALEIDO_BLOCK.address + result.bytes.length - 1;
    const inRange = spectrumMemoryBlocks.validRanges.some(
      (r) => KALEIDO_BLOCK.address >= r.start && end <= r.end,
    );
    expect(inRange).toBe(true);
    // The BASIC program POKEs 32768-32770 and calls USR 32771: pin the entry
    // so an asm edit that moves it breaks loudly here, not silently at run.
    expect(KALEIDO_BLOCK.entry).toBe(KALEIDO_BLOCK.address + 3);
  });

  it('the kaleidoscope routine fills the attributes with a 4-way mirrored pattern', () => {
    // The sample's own BASIC INPUTs the parameters; drive the same routine
    // with POKEd values instead so the test needs no keyboard scripting.
    // PAUSE 0 keeps the program alive so the ROM's end-of-run report doesn't
    // print into the lower screen and wipe the bottom attribute rows.
    const driver = [
      '10 POKE 32768,3: POKE 32769,5: POKE 32770,2',
      '20 RANDOMIZE USR 32771',
      '30 PAUSE 0',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(driver);
    expect(errors).toEqual([]);
    const engine = asmEngineFor(spectrumMemoryBlocks.cpu)!;
    const assembled = engine.assemble(
      KALEIDO_BLOCK.asmSource,
      KALEIDO_BLOCK.address,
    );
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;

    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes), {
      blocks: [
        {
          id: 'sample-kaleido',
          name: KALEIDO_BLOCK.name,
          address: KALEIDO_BLOCK.address,
          bytes: assembled.bytes,
          kind: 'code',
        },
      ],
    });
    for (let i = 0; i < 120; i++) machine.runFrame();

    // The block's bytes landed at its address...
    expect(machine.mem.read(0x8003)).toBe(assembled.bytes[3]);
    // ...and the attribute file holds a drawn pattern, not a plain CLS.
    const attrs = new Uint8Array(0x300);
    for (let a = 0; a < 0x300; a++) attrs[a] = machine.mem.read(0x5800 + a);
    const distinct = new Set(attrs).size;
    expect(distinct).toBeGreaterThan(4);

    // ...and holds the routine's 4-way mirror symmetry on every cell.
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 16; x++) {
        const v = attrs[y * 32 + x]!;
        expect(attrs[y * 32 + (31 - x)]).toBe(v);
        expect(attrs[(23 - y) * 32 + x]).toBe(v);
        expect(attrs[(23 - y) * 32 + (31 - x)]).toBe(v);
      }
    }
  });

  it('the starter runs and paints a coloured screen', () => {
    const starter = spectrumSamples[0]!;
    const { bytes } = tokenizeProgram(starter.text);
    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 80; i++) machine.runFrame();
    // The starter prints 21 lines with INK 1-6 on PAPER 0; attribute cells should hold coloured ink.
    let colouredCells = 0;
    for (let a = 0x5800; a < 0x5b00; a++) {
      const ink = machine.mem.read(a) & 0x07;
      if (ink >= 1 && ink <= 6) colouredCells++;
    }
    expect(colouredCells).toBeGreaterThan(100);
  });

  it('maze draws its walls in the emulator', () => {
    const maze = spectrumSamples.find((s) => s.name === 'maze.bas')!;
    const { bytes } = tokenizeProgram(maze.text);
    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes));
    // Tap "1" to select keyboard controls (the default), then release.
    machine.setKey('Digit1', true);
    for (let i = 0; i < 100; i++) machine.runFrame();
    machine.setKey('Digit1', false);
    // Press Space to pass the "PRESS SPACE TO START" gate, then release.
    for (let i = 0; i < 5; i++) machine.runFrame();
    machine.setKey('Space', true);
    for (let i = 0; i < 10; i++) machine.runFrame();
    machine.setKey('Space', false);
    // Run remaining frames for the maze to draw.
    for (let i = 0; i < 200; i++) machine.runFrame();
    // The maze prints a full 31x19 wall map with INK 4 on PAPER 0 (attr 0x04).
    let mazeCells = 0;
    for (let a = 0x5800; a < 0x5b00; a++) {
      if (machine.mem.read(a) === 0x04) mazeCells++;
    }
    expect(mazeCells).toBeGreaterThan(100);
  });

  it('breakout reads the Kempston joystick (IN 31) to steer the paddle', () => {
    const breakout = spectrumSamples.find((s) => s.name === 'breakout.bas')!;
    const { bytes } = tokenizeProgram(breakout.text);
    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes));

    const idle = {
      left: false,
      right: false,
      up: false,
      down: false,
      fire1: false,
      fire2: false,
    };

    // Pick "2. KEMPSTON JOYSTICK" on the welcome screen, then let go.
    machine.setKey('Digit2', true);
    for (let i = 0; i < 140; i++) machine.runFrame();
    machine.setKey('Digit2', false);

    // The menu stored the Kempston mode in M, and the paddle starts mid-screen.
    expect(machine.readVariables().find((v) => v.name === 'M')?.value).toBe(
      '2',
    );

    // Press Kempston fire to pass the "PRESS FIRE TO START" gate.
    for (let i = 0; i < 5; i++) machine.runFrame();
    machine.setJoystick!('kempston', { ...idle, fire1: true });
    for (let i = 0; i < 10; i++) machine.runFrame();
    machine.setJoystick!('kempston', idle);

    // Let the game initialise, then read the starting paddle position.
    for (let i = 0; i < 30; i++) machine.runFrame();
    const paddleX = () =>
      Number(machine.readVariables().find((v) => v.name === 'X')?.value);
    const start = paddleX();

    // Pushing the Kempston stick right (bit 0) walks the paddle right…
    machine.setJoystick!('kempston', { ...idle, right: true });
    for (let i = 0; i < 60; i++) machine.runFrame();
    expect(paddleX()).toBeGreaterThan(start);

    // …and pushing it left (bit 1) walks it back.
    machine.setJoystick!('kempston', { ...idle, left: true });
    for (let i = 0; i < 60; i++) machine.runFrame();
    expect(paddleX()).toBeLessThan(start + 1);
  });
});
