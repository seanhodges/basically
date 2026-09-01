// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';

/**
 * The machine had no cassette and no serial port, so the honest export is the
 * one a teletype could actually produce: plain ASCII paper tape, or a listing.
 * `altair8800/targets.ts` is the model, including the CR LF a Teletype needs.
 */
export const ge235BuildTargets: BuildTarget[] = [];
