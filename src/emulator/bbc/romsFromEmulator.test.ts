import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bbcmicro } from '../../dialects/bbcmicro';
import {
  canRunMachine,
  configureRomRoot,
  bootMachine,
  hasRom,
  installNodeRomLoading,
  runUntil,
  screenText,
} from '../../dialects/bootHarness';

/**
 * The Acorns run on an installation that carries none of the product's images.
 *
 * jsbeeb resolves its own ROM set out of its package rather than taking the
 * image the seam hands it, so "is there a file under the product's ROM
 * directory?" is the wrong question for these machines - and answering it would
 * report a machine that boots perfectly as one a caller should not try. The
 * published toolchain ships no images at all, which is what makes this the
 * ordinary case rather than an edge one.
 *
 * Proved by pointing the product's ROM directory at an empty one, so nothing
 * here can be answered by the checkout's own files.
 */

/** One boot of the real ROM set; nothing else here costs anything. */
const BOOT_TIMEOUT_MS = 120_000;

/** Frames to reach the BASIC prompt. A cap on a predicate, so a fast boot pays nothing. */
const MAX_FRAMES = 600;

describe('a machine whose emulator carries its own ROMs', () => {
  let restoreRomLoading: () => void;
  const checkoutRoms = path.resolve(__dirname, '../../../public');

  beforeAll(() => {
    restoreRomLoading = installNodeRomLoading();
    // An empty directory, so every answer below comes from the emulator package
    // rather than from an image this checkout happens to carry.
    configureRomRoot(mkdtempSync(path.join(tmpdir(), 'basically-no-roms-')));
  });

  afterAll(() => {
    configureRomRoot(checkoutRoms);
    restoreRomLoading();
  });

  it('reports its ROM as available with no image filed under the product\u2019s', () => {
    expect(bbcmicro.emulatorSuppliesRom).toBe(true);
    expect(hasRom(bbcmicro)).toBe(true);
    expect(canRunMachine(bbcmicro)).toBe(true);
  });

  it(
    'boots to its prompt all the same',
    async () => {
      const machine = await bootMachine(bbcmicro);
      try {
        const reached = await runUntil(
          machine,
          () => screenText(machine).includes('BASIC'),
          MAX_FRAMES,
        );
        expect(
          reached,
          `the BBC Micro did not reach its banner in ${MAX_FRAMES} frames ` +
            'with no image filed under the product\u2019s ROM directory',
        ).toBe(true);
      } finally {
        machine.dispose();
      }
    },
    BOOT_TIMEOUT_MS,
  );
});
