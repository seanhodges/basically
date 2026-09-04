import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { dialects } from './registry';
import { fitRomImage } from '../app/romImage';
import {
  HeadlessCanvas,
  installCanvasGlobals,
} from './headless/headlessCanvas';
import {
  bootMachine,
  installNodeRomLoading,
  romFor,
  romPath,
  runFrames,
  screenText,
} from './bootHarness';
import type { Dialect } from './types';

/**
 * `Dialect.romBytes` says two things at once: that this machine runs the image
 * the seam hands it (so the user may replace it), and how big the ROM area a
 * replacement is fitted to is. Both halves have to stay true on their own, and
 * neither is checked by the type system.
 *
 * The size half is easy to pin and easy to get wrong once - it is compared to
 * the committed image below.
 *
 * The behavioural half is the one that matters, because it is the one that
 * drifts. Six registered dialects declare a `romUrl` and then ignore
 * `opts.rom` entirely - the Acorn machines let jsbeeb resolve its own ROM list,
 * the Commodore machines fetch their own sets - so "declares a ROM URL" is not
 * the same claim as "runs the ROM it is given", and the settings page offers a
 * replacement based on the second. This file asserts the second **in both
 * directions**: a machine declaring `romBytes` must visibly change when given a
 * different image, and a machine not declaring it must visibly not. The day
 * someone wires `opts.rom` into one of the machines that currently ignores it,
 * the negative case fails and says to declare the field.
 */

let restoreRomLoading: () => void;
let restoreCanvas: () => void;

beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
  // The machines that scale their frame through a back canvas need one even to
  // draw a notice on it.
  restoreCanvas = installCanvasGlobals();
});

afterAll(() => {
  restoreCanvas();
  restoreRomLoading();
});

/** Boot a machine on the given image and read back what is on its screen. */
async function screenAfterBoot(
  dialect: Dialect,
  rom: Uint8Array,
): Promise<string> {
  const machine = await bootMachine(dialect, { rom });
  try {
    await runFrames(machine, 200);
    return screenText(machine);
  } finally {
    machine.dispose();
  }
}

const withRomBytes = dialects.filter((d) => d.romBytes !== undefined);
/** Machines with a bundled image but no claim to run it - the negative case. */
const withoutRomBytes = dialects.filter(
  (d) => d.romBytes === undefined && d.romUrl !== undefined,
);

describe('romBytes matches the committed image', () => {
  for (const dialect of withRomBytes) {
    const url = dialect.romUrl;
    const file = url ? romPath(url) : null;
    // A checkout with a ROM removed must stay green: images with no
    // redistribution grant are meant to be removable, which is the very thing
    // this feature exists to support.
    const test = file && existsSync(file) ? it : it.skip;
    test(`${dialect.id} declares the size of its bundled ROM`, () => {
      expect(statSync(file!).size).toBe(dialect.romBytes);
    });
  }

  it('every dialect declaring romBytes also declares romUrl', () => {
    // Not a law of the seam - a machine whose image could not ship would
    // declare romBytes with no romUrl. Relax this the day such a machine is
    // registered.
    for (const dialect of withRomBytes) {
      expect(
        dialect.romUrl,
        `${dialect.id} declares romBytes but no romUrl`,
      ).toBeDefined();
    }
  });

  it('covers the machines that take a replaceable ROM', () => {
    expect(withRomBytes.length).toBeGreaterThan(0);
  });
});

describe('romBytes tells the truth about opts.rom', () => {
  for (const dialect of withRomBytes) {
    const url = dialect.romUrl;
    const file = url ? romPath(url) : null;
    const test = file && existsSync(file) ? it : it.skip;
    test(`${dialect.id} runs the image it is given`, async () => {
      const real = await screenAfterBoot(dialect, romFor(url));
      const blank = await screenAfterBoot(
        dialect,
        new Uint8Array(dialect.romBytes!),
      );
      // Guard against a vacuous pass: if the real image produced nothing
      // either, "different" would prove nothing.
      expect(
        real.trim().length,
        `${dialect.id} did not boot far enough on its real ROM to compare`,
      ).toBeGreaterThan(0);
      expect(
        blank,
        `${dialect.id} declares romBytes, so a different image must change what it runs`,
      ).not.toBe(real);
    }, 30_000);
  }

  for (const dialect of withoutRomBytes) {
    const url = dialect.romUrl;
    const file = url ? romPath(url) : null;
    const test = file && existsSync(file) ? it : it.skip;
    test(`${dialect.id} ignores the image it is given`, async () => {
      const real = romFor(url);
      const a = await screenAfterBoot(dialect, real);
      const b = await screenAfterBoot(dialect, new Uint8Array(real.length));
      expect(
        a.trim().length,
        `${dialect.id} did not boot far enough to compare`,
      ).toBeGreaterThan(0);
      expect(
        b,
        `${dialect.id} now behaves differently depending on opts.rom, so it takes a replaceable ROM - declare romBytes on it (and let the settings page offer the upload)`,
      ).toBe(a);
    }, 30_000);
  }
});

/**
 * An absent image is a designed state, not a failure: the ROMs with no
 * redistribution grant are meant to be removable
 * (`public/roms/ATTRIBUTION.md`), so a checkout without one has to stay usable.
 * Every machine that takes its ROM through the seam agrees on what an *empty*
 * image means - construct, and say on screen that there is nothing to run - and
 * the ZX81 agreed with neither half until this was pinned: it threw inside its
 * memory constructor, which no layer above could turn into an answer.
 *
 * What a machine does with a *wrong-length* image is deliberately its own
 * business and is not asserted here. The Sinclairs and the CPCs refuse one,
 * because a prefix of the wrong file boots a dead machine with nothing to
 * explain it; the Apple I accepts a short image on purpose, since a monitor PROM
 * with no BASIC after it is a real Apple I. Each is pinned beside the machine
 * that decides it.
 *
 * The machines that *fetch* their own ROM sets (the Acorns and the Commodores,
 * the `withoutRomBytes` set above) are not here: they never see `opts.rom`, and
 * a set that fails to arrive is caught by each adapter and drawn as its own
 * load-error banner instead.
 */
describe('a machine handed no image at all', () => {
  for (const dialect of withRomBytes) {
    it(`${dialect.id} runs a program on an empty image and says it has none`, () => {
      const machine = dialect.createEmulator({
        rom: new Uint8Array(0),
        ramKb: 16,
      });
      try {
        // The whole path a run takes, not just the constructor: the ZX81 threw
        // in its memory and then, once that was fixed, threw again inside
        // `bootToBasic` waiting for a prompt no ROM was ever going to print.
        machine.loadProgram(new Uint8Array([0]));
        for (let i = 0; i < 5; i++) machine.runFrame();
        // "Cannot say" rather than a made-up answer: nothing ran, so the
        // machine must not report a program as running or as finished.
        expect(
          machine.isProgramRunning(),
          `${dialect.id} answers about a program it never ran`,
        ).not.toBe(true);

        const canvas = new HeadlessCanvas(
          machine.displayWidth,
          machine.displayHeight,
        );
        machine.renderTo(canvas.renderContext);
        // Drawn in the host's font, because the character generator is in the
        // ROM that is missing - so glyphs, not the machine's own pixels, are
        // what says the notice is really there. A blank screen is the failure
        // this replaces: it looks exactly like a machine that is broken.
        expect(
          canvas.hostFontGlyphs,
          `${dialect.id} draws nothing to say its ROM is missing`,
        ).toBeGreaterThan(0);
      } finally {
        machine.dispose();
      }
    });
  }
});

/**
 * A user may now supply an image of any size; it is fitted to the machine's ROM
 * area before `createEmulator` sees it (`app/romImage.fitRomImage`). Every
 * machine that runs a supplied image builds its memory from that buffer and
 * rejects a wrong length, so the fit is the only thing standing between an
 * odd-sized file and a constructor that throws. This asserts it holds for every
 * machine, including any added later.
 */
describe('a fitted image of any size builds the machine', () => {
  for (const dialect of withRomBytes) {
    const expected = dialect.romBytes!;
    it(`${dialect.id} accepts a padded short image and a trimmed long one`, () => {
      for (const supplied of [
        new Uint8Array(0),
        new Uint8Array(1).fill(0xc9),
        new Uint8Array(Math.floor(expected / 2)).fill(0xc9),
        new Uint8Array(expected * 2 + 3).fill(0xc9),
      ]) {
        const rom = fitRomImage(supplied, expected);
        expect(rom.length).toBe(expected);
        const machine = dialect.createEmulator({ rom, ramKb: 16 });
        machine.dispose();
      }
    });
  }
});
