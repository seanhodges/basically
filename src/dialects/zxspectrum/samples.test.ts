import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spectrumSamples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { buildTap } from './tapfile';
import { SpectrumMachine } from './emulator/spectrumMachine';

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
    // Dismiss the welcome screen by holding "1" (keyboard controls, the default);
    // it is not a movement key (5/6/7/8) so the player stays put while it draws.
    machine.setKey('Digit1', true);
    for (let i = 0; i < 300; i++) machine.runFrame();
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
    // Pick "2. KEMPSTON JOYSTICK" on the welcome screen, then let go.
    machine.setKey('Digit2', true);
    for (let i = 0; i < 140; i++) machine.runFrame();
    machine.setKey('Digit2', false);
    const paddleX = () =>
      Number(machine.readVariables().find((v) => v.name === 'X')?.value);
    // The menu stored the Kempston mode in M, and the paddle starts mid-screen.
    expect(machine.readVariables().find((v) => v.name === 'M')?.value).toBe(
      '2',
    );
    const start = paddleX();

    // Pushing the Kempston stick right (bit 0) walks the paddle right…
    const idle = {
      left: false,
      right: false,
      up: false,
      down: false,
      fire1: false,
      fire2: false,
    };
    machine.setJoystick!('kempston', { ...idle, right: true });
    for (let i = 0; i < 60; i++) machine.runFrame();
    expect(paddleX()).toBeGreaterThan(start);

    // …and pushing it left (bit 1) walks it back.
    machine.setJoystick!('kempston', { ...idle, left: true });
    for (let i = 0; i < 60; i++) machine.runFrame();
    expect(paddleX()).toBeLessThan(start + 1);
  });
});
