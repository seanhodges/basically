/**
 * What the ULA's share of the bus costs a running program, measured on the
 * machine rather than on the model.
 *
 * `ulaContention.test.ts` pins the delay table; this pins that the table is
 * actually reaching the CPU, and only the CPU. The measurement is in loop
 * iterations rather than pixels on purpose: a picture assertion cannot tell a
 * routine running at the right period from one running short without a
 * hand-timed routine to compare against, which would only be pinning our own
 * arithmetic back to itself.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SpectrumMachine } from './spectrumMachine';
import { tokenizeProgram } from '../tokenizer';
import { buildTap } from '../tapfile';
import type { MemoryBlock } from '../../types';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../../public/roms/zxspectrum.rom')),
);

/** Where the counter lives: uncontended in both runs, so only the code moves. */
const COUNTER = 0xbf00;
/** General RAM inside the ULA's 16K, clear of the display file and workspace. */
const CONTENDED_CODE = 0x7000;
/** RAM above 0x8000, which the ULA never touches. */
const UNCONTENDED_CODE = 0xc000;

/**
 * `LD HL,0` then forever: `INC HL`, `LD (COUNTER),HL`, `JR` back.
 *
 * 34 T-states an iteration on paper. Six of its bus accesses come from the
 * routine's own bytes - three opcode fetches and three operand reads - so
 * moving the routine into the ULA's 16K is what the two runs differ by; the
 * two writes to the counter are uncontended either way.
 */
function counterLoop(address: number): MemoryBlock {
  return {
    id: 'counter',
    name: 'Counter',
    address,
    bytes: new Uint8Array([
      0x21,
      0x00,
      0x00,
      0x23,
      0x22,
      COUNTER & 0xff,
      COUNTER >> 8,
      0x18,
      0xf9,
    ]),
    kind: 'code',
  };
}

/** Boot, start the loop at `address`, and run `frames` whole frames. */
function runLoop(address: number, frames: number): SpectrumMachine {
  const machine = new SpectrumMachine({ rom });
  const { bytes, errors } = tokenizeProgram(`10 RANDOMIZE USR ${address}\n`);
  expect(errors).toEqual([]);
  machine.loadProgram(buildTap(bytes), { blocks: [counterLoop(address)] });
  for (let i = 0; i < frames; i++) machine.runFrame();
  return machine;
}

/** The loop's counter, read without disturbing the machine. */
function counter(machine: SpectrumMachine): number {
  return machine.mem.rawReadWord(COUNTER);
}

describe('ULA contention on a running machine', () => {
  it('costs a contended routine part of every frame, and charges it nowhere else', () => {
    // Let the loop start, then measure over a window of whole frames.
    const SETTLE = 30;
    const WINDOW = 20;

    const free = runLoop(UNCONTENDED_CODE, SETTLE);
    const freeStart = counter(free);
    const freeStalls = free.contendedTStates;
    for (let i = 0; i < WINDOW; i++) free.runFrame();
    const freeIterations = (counter(free) - freeStart) / WINDOW;
    const freeStallsPerFrame = (free.contendedTStates - freeStalls) / WINDOW;

    const held = runLoop(CONTENDED_CODE, SETTLE);
    const heldStart = counter(held);
    const heldStalls = held.contendedTStates;
    for (let i = 0; i < WINDOW; i++) held.runFrame();
    const heldIterations = (counter(held) - heldStart) / WINDOW;
    const heldStallsPerFrame = (held.contendedTStates - heldStalls) / WINDOW;

    // The loop really is running: a 34 T iteration over what the ROM's frame
    // interrupt leaves of the 69888.
    expect(freeIterations).toBeGreaterThan((69888 / 34) * 0.85);
    expect(freeIterations).toBeLessThanOrEqual(69888 / 34);

    // And it gets meaningfully less done from inside the ULA's 16K. The band is
    // wide because the exact figure depends on how the loop's six contended
    // accesses fall across the 128 contended T-states of each display line;
    // what matters is that a routine in screen RAM loses a real slice of the
    // frame and an identical one above 0x8000 does not.
    expect(heldIterations).toBeLessThan(freeIterations);
    expect(heldIterations / freeIterations).toBeGreaterThan(0.8);
    expect(heldIterations / freeIterations).toBeLessThan(0.95);

    // The cycles went where this says they went, and nowhere else. Zero for the
    // uncontended run is not an accident of the loop's address: the ROM's frame
    // interrupt does touch contended system variables, but it finishes long
    // before the ULA starts fetching the picture, so it is charged nothing.
    expect(freeStallsPerFrame).toBe(0);
    expect(heldStallsPerFrame).toBeGreaterThan(4000);
  });

  it('charges the machine nothing for the host reading it', () => {
    const machine = runLoop(UNCONTENDED_CODE, 20);
    const before = machine.contendedTStates;
    machine.readScreenText();
    machine.readMemoryStats();
    machine.currentLine();
    machine.mem.read(0x4000);
    expect(machine.contendedTStates).toBe(before);
  });
});
