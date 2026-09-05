// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Apple2BasicSupport } from '../../emulator/apple2/apple2Machine';
import type { Apple2Memory } from '../../emulator/apple2/memory';
import type { WritableMemory } from '../../emulator/microsoftBasicLoad';
import { loadMicrosoftBasicProgram } from '../../emulator/microsoftBasicLoad';
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
  CURLIN,
  DEFAULT_MEMSIZ,
  DIRECT_MODE_MARK,
  FRETOP,
  MAX_LINE,
  MEMSIZ,
  PROGRAM_BASE,
  STREND,
  TXTTAB,
} from './addresses';
import { basicImagePointers, parseBasicImage } from './basicImage';
import { readApple2plusReport } from './reports';
import { readApple2plusVariables } from './vars';

/**
 * What the shared Apple II emulator needs to know about Applesoft.
 *
 * The board is the same machine in both this dialect and the Apple II; the
 * interpreter in its sockets is not, and everything here is about the
 * interpreter. See `Apple2BasicSupport` for why this is an object rather than a
 * flag inside the machine.
 */
export const applesoftSupport: Apple2BasicSupport = {
  machineName: 'Apple II Plus',
  romPath: 'public/roms/apple2plus.rom',
  coldEntry: BASIC_COLD_ENTRY,
  // The Autostart Monitor runs the cold start out of reset, so this machine is
  // at `]` having been asked nothing. Typing `E000G` at it would find the
  // prompt on the first field and leave the command in the keyboard.
  autostart: true,
  commandLoop: BASIC_COMMAND_LOOP,
  prompt: BASIC_PROMPT,

  /**
   * Lay a program into the workspace of a machine already at the `]` prompt.
   *
   * The Microsoft-family recipe, which is what `LOAD` leaves behind here: the
   * image goes at `TXTTAB` and the words that say where the program ends are
   * fixed behind it. Applesoft's program is always at {@link PROGRAM_BASE}, so
   * unlike the sibling's there is no workspace for the caller to have set up
   * first and nothing in the image that could disagree with the machine.
   *
   * **Two of the helper's four steps are the machine's here.** `Apple2Machine`
   * pokes the document's blocks itself and types `RUN` itself, so this passes
   * no blocks and a `typeRun` that does nothing; supplying either would poke
   * the blocks twice and run the program twice.
   */
  loadProgram(mem: Apple2Memory, image: Uint8Array): void {
    const program = parseBasicImage(image).program;
    // An image that would run past MEMSIZ into the string space is a broken
    // one, and writing it would take the pointers with it.
    if (PROGRAM_BASE + program.length >= mem.peekWord(MEMSIZ)) return;
    loadMicrosoftBasicProgram(writable(mem), program, {
      programBase: PROGRAM_BASE,
      pointers: basicImagePointers(program),
      typeRun: () => {},
    });
  },

  /**
   * The line about to execute, from CURLIN - which holds the line **number**
   * rather than a pointer, unlike the sibling's `PLINE`. Null in direct mode,
   * which the ROM marks by putting {@link DIRECT_MODE_MARK} in the high byte:
   * no line number reaches that far, so the high byte alone answers it.
   *
   * **The mark goes in when a line is *typed*, not when a program stops.** The
   * `LDX #$FF / STX $76` is in the command loop after `GETLN` returns, so
   * between a program ending and the next thing being entered CURLIN still
   * names the line it stopped on - which is what `CONT` resumes from and what
   * a `?... ERROR IN 30` report quotes. So this is the line the interpreter is
   * *on*, and "is a program running" is the run latch's question rather than
   * this one's.
   */
  currentLine(mem: Apple2Memory): number | null {
    if (mem.peek(CURLIN + 1) === DIRECT_MODE_MARK) return null;
    const line = mem.peekWord(CURLIN);
    return line <= MAX_LINE ? line : null;
  },

  /**
   * What the workspace holds, and what is left of it.
   *
   * `STREND` is the top of everything the program has allocated upwards - the
   * program text, then the scalars, then the arrays - and `FRETOP` is the
   * bottom of the string space growing down from `MEMSIZ`. The gap between them
   * is the free space, and it is what `FRE(0)` reports.
   */
  readMemoryStats(mem: Apple2Memory): MachineMemoryStats | null {
    const txttab = mem.peekWord(TXTTAB);
    const strend = mem.peekWord(STREND);
    const fretop = mem.peekWord(FRETOP);
    const memsiz = mem.peekWord(MEMSIZ);
    // Before the cold start has laid the pointers down there is no workspace to
    // describe, and a machine part-way through an injection describes one that
    // does not hold together.
    if (txttab !== PROGRAM_BASE || memsiz > DEFAULT_MEMSIZ) return null;
    if (!(txttab <= strend && strend <= fretop && fretop <= memsiz))
      return null;
    return {
      used: memsiz - txttab - (fretop - strend),
      free: fretop - strend,
    };
  },

  /**
   * The variable table, read straight out of RAM through `peek` rather than
   * through the bus: the watcher polls every frame while a program runs, and
   * going via the recording path would stamp the memory-activity overlay with
   * the IDE's own reads.
   */
  readVariables(mem: Apple2Memory): MachineVariable[] {
    return readApple2plusVariables(mem);
  },

  /** What the interpreter printed, there being nowhere else it records it. */
  readReport(screen: MachineScreenText | null): MachineReport | null {
    return readApple2plusReport(screen);
  },
};

/**
 * The helper's memory seam over this machine's.
 *
 * `loadMicrosoftBasicProgram` spells its writes `write`/`writeWord` because the
 * machines it was written for do; `Apple2Memory` spells them `poke`/`pokeWord`
 * because the monitor does. Neither name is worth changing for the other.
 */
function writable(mem: Apple2Memory): WritableMemory {
  return {
    write: (address, value) => mem.poke(address, value),
    writeWord: (address, value) => mem.pokeWord(address, value),
  };
}
