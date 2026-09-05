// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AiProfile } from '../types';
import { atariAiProfile } from '../atari800/aiProfile';

/**
 * The 400 runs the same Atari BASIC cartridge as the 800, so everything the
 * assistant is told about the language is shared. What it must be told
 * differently is the memory: a program that fits on an 800 need not fit here,
 * and the high-resolution modes take a quarter of this machine's RAM.
 */
export const atari400AiProfile: AiProfile = atariAiProfile('Atari 400', [
  'This machine has 16K of RAM, a quarter of the 800’s, leaving a program about 13K.',
  'A full-screen GRAPHICS 8 or GRAPHICS 11 display takes 8K of that, so keep programs small and prefer a redrawn GRAPHICS 0 screen where the picture allows it.',
]);
