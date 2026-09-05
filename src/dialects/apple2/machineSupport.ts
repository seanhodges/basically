// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Apple2BasicSupport } from '../../emulator/apple2/apple2Machine';
import type { Apple2Memory } from '../../emulator/apple2/memory';
import type {
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  MachineVariable,
} from '../types';
import {
  BASIC_COLD_ENTRY,
  BASIC_COMMAND_LOOP,
  BASIC_PROMPT,
  HIMEM,
  LOMEM,
  MAX_HIMEM,
  MAX_LINE,
  MIN_LOMEM,
  PLINE,
  PP,
  PV,
} from './addresses';
import { parseBasicImage } from './basicImage';
import { readApple2Report } from './reports';
import { readApple2Variables } from './vars';

/**
 * What the shared Apple II emulator needs to know about Integer BASIC.
 *
 * The board is the same machine in both this dialect and the Apple II Plus; the
 * interpreter in its sockets is not, and everything here is about the
 * interpreter. See `Apple2BasicSupport` for why this is an object rather than a
 * flag inside the machine.
 */
export const integerBasicSupport: Apple2BasicSupport = {
  machineName: 'Apple II',
  romPath: 'public/roms/apple2.rom',
  coldEntry: BASIC_COLD_ENTRY,
  commandLoop: BASIC_COMMAND_LOOP,
  prompt: BASIC_PROMPT,

  /**
   * Lay a program into the workspace of a machine already at the `>` prompt.
   *
   * This is the state a completed `LOAD` leaves behind, and `LOAD` is where the
   * shape comes from: the interpreter reads the record's length, sets
   * `PP = HIMEM - length` and reads that many bytes down from the top of the
   * workspace. The bounds themselves are **not** in the image and are not set
   * here - a program does not remember the `HIMEM:` it was written under, which
   * is why a real Apple II owner types the bounds before `LOAD` rather than
   * after. What the machine has is what it gets.
   *
   * An image too big for the workspace is a broken one; its leading bytes are
   * kept rather than written below `LOMEM`, where the variables live.
   */
  loadProgram(mem: Apple2Memory, image: Uint8Array): void {
    const lomem = mem.peekWord(LOMEM);
    const himem = mem.peekWord(HIMEM);
    // Before the cold start has laid the pointers down there is no workspace to
    // write into, and one outside the fitted RAM is not this machine's.
    if (lomem < MIN_LOMEM || lomem >= himem || himem > MAX_HIMEM) return;

    const text = parseBasicImage(image).program.subarray(0, himem - lomem);
    const start = himem - text.length;
    for (let i = 0; i < text.length; i++) mem.poke(start + i, text[i]!);
    mem.pokeWord(PP, start);
    // No variables yet; `RUN` clears them again in any case.
    mem.pokeWord(PV, lomem);
  },

  /**
   * The line about to execute, from PLINE - which holds a *pointer* to the
   * line's length byte rather than a line number, so the number is the word
   * that follows it. Null while it points outside the stored program, which is
   * where it sits in direct mode.
   */
  currentLine(mem: Apple2Memory): number | null {
    const pline = mem.peekWord(PLINE);
    if (pline < mem.peekWord(PP)) return null;
    if (pline >= mem.peekWord(HIMEM)) return null;
    const line = mem.peek(pline + 1) | (mem.peek(pline + 2) << 8);
    return line <= MAX_LINE ? line : null;
  },

  /**
   * What the workspace holds, and what is left of it.
   *
   * The one figure on this interpreter that has to count from both ends: the
   * variables run up from LOMEM to PV and the program down from PP to HIMEM,
   * with the free space in the middle. A reading that counted only the program
   * text would report a program that allocates nothing.
   */
  readMemoryStats(mem: Apple2Memory): MachineMemoryStats | null {
    const lomem = mem.peekWord(LOMEM);
    const himem = mem.peekWord(HIMEM);
    const pp = mem.peekWord(PP);
    const pv = mem.peekWord(PV);
    // At the monitor the pointers are all zero, and a machine part-way through
    // an injection describes a workspace that does not hold together.
    if (himem <= lomem) return null;
    if (!(lomem <= pv && pv <= pp && pp <= himem)) return null;
    return { used: himem - lomem - (pp - pv), free: pp - pv };
  },

  /**
   * The variable table, read straight out of the RAM array rather than through
   * `peek`: the watcher polls every frame while a program runs, and going via
   * the bus would stamp the memory-activity overlay with the IDE's own reads.
   */
  readVariables(mem: Apple2Memory): MachineVariable[] {
    return readApple2Variables(mem.mem);
  },

  /** What the interpreter printed, there being nowhere else it records it. */
  readReport(screen: MachineScreenText | null): MachineReport | null {
    return readApple2Report(screen);
  },
};
