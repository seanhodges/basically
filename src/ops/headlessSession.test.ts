import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  bootMachine,
  installNodeRomLoading,
  runUntil,
} from '../dialects/bootHarness';
import {
  encodePng,
  HeadlessCanvas,
  installCanvasGlobals,
} from '../dialects/headless/headlessCanvas';
import { resolveTokenize } from '../dialects/resolveListing';
import { getDialect } from '../dialects/registry';
import type { MachineEmulator } from '../dialects/types';
import { RunMeasurements } from '../app/runMeasurements';
import { decodeBytes } from './bytes';
import { createHeadlessSession } from './headlessSession';

/**
 * The headless session over a real machine: what it captures, measures and
 * reads back is the machine's own, through the same driver and the same fold
 * the browser's session uses.
 */

/** Frames enough for the ZX81 to run a two-line program to its prompt. */
const MAX_FRAMES = 400;

let restore: (() => void)[] = [];
beforeEach(() => {
  restore = [installNodeRomLoading(), installCanvasGlobals()];
});
afterEach(() => {
  for (const undo of restore.reverse()) undo();
});

async function loaded(source: string): Promise<MachineEmulator> {
  const dialect = getDialect('zx81');
  const machine = await bootMachine(dialect);
  machine.loadProgram(resolveTokenize(dialect, source).image);
  await new Promise((r) => setTimeout(r, 0));
  return machine;
}

describe('the headless session', () => {
  it('measures a run, times it and reads a variable back', async () => {
    const dialect = getDialect('zx81');
    const source = '10 LET A=7\n20 PRINT A\n';
    const machine = await loaded(source);
    try {
      const measurements = new RunMeasurements(null, source);
      measurements.arm(machine);
      await runUntil(
        machine,
        () => measurements.settled,
        MAX_FRAMES,
        () => void measurements.frame(machine),
      );
      const session = createHeadlessSession({
        machine,
        dialect,
        step: () => machine.runFrame(),
        source,
        measurements,
        paint: () => ({ width: 1, height: 1, rgba: new Uint8ClampedArray(4) }),
        encodePng,
      });

      const { canProfile, profile } = session.measurements();
      expect(canProfile).toBe(true);
      expect(profile?.lines.length).toBeGreaterThan(0);
      expect(session.timing()?.ending).toBe('finished');
      expect(session.variables()).toContainEqual(
        expect.objectContaining({ name: 'A', value: '7' }),
      );
      expect(session.readText()?.lines.some((l) => l.includes('7'))).toBe(true);
    } finally {
      machine.dispose();
    }
  }, 20_000);

  it("captures the display as a PNG of the machine's own size", async () => {
    const dialect = getDialect('zx81');
    const machine = await loaded('10 PRINT "HI"\n');
    try {
      await runUntil(
        machine,
        () => machine.isProgramRunning() === false,
        MAX_FRAMES,
      );
      const canvas = new HeadlessCanvas(
        machine.displayWidth,
        machine.displayHeight,
      );
      const session = createHeadlessSession({
        machine,
        dialect,
        step: () => machine.runFrame(),
        source: '',
        measurements: null,
        paint: () => {
          machine.renderTo(canvas.renderContext);
          return {
            width: canvas.width,
            height: canvas.height,
            rgba: canvas.rgba,
          };
        },
        encodePng,
      });
      const picture = session.capture()!;
      expect(picture.width).toBe(machine.displayWidth);
      expect(picture.height).toBe(machine.displayHeight);
      expect([...decodeBytes(picture.png).subarray(0, 4)]).toEqual([
        0x89, 0x50, 0x4e, 0x47,
      ]);
      // Nothing measured: said as such, never as a program that took no time.
      expect(session.measurements().profile).toBeNull();
      expect(session.timing()).toBeNull();
    } finally {
      machine.dispose();
    }
  }, 20_000);
});
