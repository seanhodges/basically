// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { configureRomRoot, hasRom } from '../dialects/bootHarness';
import { findRomRoot, runListing } from '../dialects/headless/runListing';
import { encodePng, HeadlessCanvas } from '../dialects/headless/headlessCanvas';
import type { OpContext } from '../ops/types';

/**
 * Point the ROM loaders at this installation's `public/`.
 *
 * Bundled, nothing here knows where the installation is - the bundle's own path
 * is wherever it was written - so the directory is searched for rather than
 * derived. Running a listing does this for itself; the operations that only ask
 * whether a ROM is *present* have to do it too, or every machine reads as
 * ROM-less from anywhere but the source tree.
 *
 * Not memoised: an installation with no ROMs is a supported state, and the
 * answer is a fact about the filesystem now rather than at first ask.
 *
 * A caller who named a `public/` of its own passes it, so asking whether a ROM
 * is there means the same thing as running against it.
 */
export function locateRoms(romRoot?: string): void {
  const root = romRoot ?? findRomRoot();
  if (root) configureRomRoot(root);
}

/**
 * The context the command line runs every operation in: ROMs found on disk,
 * a machine booted by the headless runner, and the display painted through
 * the headless canvas. The node-only edge of the toolchain, in one place.
 */
export function cliContext(romRoot?: string): OpContext {
  return {
    roms: {
      present: (dialect) => {
        locateRoms(romRoot);
        return hasRom(dialect);
      },
    },
    session: null,
    runner: runListing,
    painting: {
      painter: (machine) => {
        // One canvas for the session: painting into it again reads the
        // machine's current picture, exactly as the runner's own does.
        const canvas = new HeadlessCanvas(
          machine.displayWidth,
          machine.displayHeight,
        );
        return () => {
          machine.renderTo(canvas.renderContext);
          return {
            width: canvas.width,
            height: canvas.height,
            rgba: canvas.rgba,
          };
        };
      },
      encodePng,
    },
  };
}
