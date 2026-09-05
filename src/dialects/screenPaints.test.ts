import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import { canRunMachine, installNodeRomLoading } from './bootHarness';
import { runListing } from './headless/runListing';
import { screenLines } from './headless/runListing';

/**
 * Every registered machine runs its starter sample and paints a picture.
 *
 * The pixels a machine draws used to be unreachable from node - `renderTo`
 * takes a canvas, and there was none - so this was checked in a browser, at
 * about four seconds a machine, which is why it covered five of them and said
 * so in a comment. `headless/headlessCanvas` supplies the canvas, and the whole
 * registry now costs about what one browser boot did.
 *
 * What stays in the browser is what only a browser can say: that the app's own
 * canvas and frame loop are wired to the machine at all, and that the screenshot
 * button encodes a PNG. `e2e/program-execution/emulator-boot.spec.ts` boots one
 * machine for that. The per-machine matrix is here.
 *
 * Two assertions, and the second is the one that catches a real failure. A frame
 * of more than one colour only says something was drawn - a machine that boots
 * to its ROM banner and never runs the program passes that on its own. Pairing
 * it with the screen text is what makes the pair mean "this machine ran the
 * program and drew the result".
 *
 * Budget: booting is the cheap part and frames are the cost, so the cap below
 * does the work of keeping this file off the shard's floor.
 */

/** Booting the real ROMs dominates every case here (see c64Machine.test.ts). */
const BOOT_TIMEOUT_MS = 120_000;

/**
 * Frames a sample gets to put something on screen.
 *
 * A cap on a predicate rather than a count to run, because most of these
 * samples never end: they greet and then loop over a screen they keep clearing,
 * so there is no settled picture and any fixed number lands on an arbitrary
 * moment of the animation. The ZX81's and the PMD 85's read blank at a hundred
 * frames and again at eight hundred, for that reason and not for any fault of
 * the machines. Stopping at the first frame that has text names the moment
 * instead, and costs nothing on the machines that reach it immediately.
 */
const MAX_FRAMES = 600;

describe('every registered machine paints its starter sample', () => {
  let restoreRomLoading: () => void;
  beforeAll(() => {
    restoreRomLoading = installNodeRomLoading();
  });
  afterAll(() => restoreRomLoading());

  for (const dialect of dialects) {
    it(
      `${dialect.id} runs hello and draws it`,
      async (ctx) => {
        // A ROM with no redistribution grant is meant to be removable
        // (public/roms/ATTRIBUTION.md), and a machine without its image draws
        // the missing-image notice instead - itself more than one colour, so it
        // would pass the paint assertion without having run anything.
        //
        // Gated on the same answer callers are given, which is what pairs this
        // file with canRun.test.ts: that one holds the rule deciding who is
        // reported runnable, and every machine it lets through has to run and
        // paint here. A machine reported runnable that cannot run fails, rather
        // than skipping quietly.
        if (!canRunMachine(dialect)) {
          ctx.skip(`${dialect.id} cannot be run in this checkout`);
        }

        const sample = dialect.samples[0];
        expect(sample, `${dialect.id} ships no starter sample`).toBeDefined();

        const result = await runListing({
          machine: dialect.id,
          source: sample!.text,
          pixels: true,
          maxFrames: MAX_FRAMES,
          // Both halves at the same instant, characters first so a frame is
          // only painted once there is something to have painted. Asserting
          // them at one moment is the point: separately, a machine passes the
          // paint on its boot banner and the text on a screen it has not drawn.
          until: (frame) =>
            (frame.screen?.lines.join('').trim() ?? '') !== '' &&
            frame.colours() > 1,
        });

        expect(
          result.errors.filter((e) => e.fatal !== false),
          `${dialect.id} could not tokenize its own starter sample`,
        ).toEqual([]);

        expect(
          result.reached,
          `${dialect.id} printed nothing in ${MAX_FRAMES} frames of ${sample!.name}`,
        ).toBe(true);

        expect(
          result.picture?.colours ?? 0,
          `${dialect.id} printed but drew a blank frame running ${sample!.name}`,
        ).toBeGreaterThan(1);

        expect(
          screenLines(result.screen).join('').trim(),
          `${dialect.id} painted something but printed nothing`,
        ).not.toBe('');
      },
      BOOT_TIMEOUT_MS,
    );
  }
});
