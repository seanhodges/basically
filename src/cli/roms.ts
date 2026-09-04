// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { configureRomRoot } from '../dialects/bootHarness';
import { findRomRoot } from '../dialects/headless/runListing';

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
