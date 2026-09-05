// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A screen as lines a reader would want.
 *
 * Apart from the runner that produces one, because reading a screen back is
 * what a caller does with an answer, and running a machine is what it takes to
 * get one: the runner reaches the dialect registry and every emulator under it.
 * A caller that only renders what it was handed pays for neither.
 */

import type { MachineScreenText } from '../types';

/** The screen's lines, without trailing blanks at the end or the right. */
export function screenLines(screen: MachineScreenText | null): string[] {
  if (!screen) return [];
  const lines = screen.lines.map((line) => line.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
