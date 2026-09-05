// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Apple2Memory } from '../../emulator/apple2/memory';
import { readC64Variables, type CbmVarsLayout } from '../../emulator/c64/vars';
import type { MachineVariable } from '../types';
import { plainChar } from '../apple2/charset';
import { ARYTAB, STREND, VARTAB } from './addresses';

/**
 * Applesoft's variable table for the watcher, which is the Commodore reader
 * pointed at this machine's zero page. Read-only.
 *
 * Applesoft is Microsoft 6502 BASIC and so are the CBM BASICs, and the tables
 * are the same tables byte for byte: seven-byte scalars whose two name bytes
 * carry the type in their bit 7 (both clear real, both set integer, second only
 * string, first only a `DEF FN` definition), a five-byte MFLPT float, a
 * three-byte string descriptor of length and address, and arrays behind their
 * own offset-to-next header. So the walk is `readC64Variables` and the only
 * thing this file supplies is where the three pointers live and how a byte of
 * string content spells a character.
 *
 * **Not `microsoftBasicVars.ts`**, which reads the same-named table for the
 * Altair and the PMD 85: those are Microsoft *8080* 8K BASIC, with a four-byte
 * float and six-byte scalars, and it would misread every entry here by one byte
 * more with each one.
 */
const APPLESOFT_VARS: CbmVarsLayout = {
  vartab: VARTAB,
  arytab: ARYTAB,
  strend: STREND,
  /**
   * Applesoft keeps string content as ASCII with bit 7 **clear** - the
   * tokenizer stores a literal that way and a descriptor may point straight at
   * it in the program text - where the screen stores the same characters with
   * bit 7 set. Setting it here is what the interpreter itself does on the way
   * to `COUT`, so both encodings decode to the one glyph the machine draws.
   *
   * A byte the character generator has no glyph for - a control code, or the
   * lower case this machine cannot display - is a dot, as it is on the
   * Commodores. `CHR$` can put any byte in a string, so this is reachable.
   */
  plainChar: (code) => plainChar(code | 0x80),
};

/**
 * Every variable the interpreter currently holds.
 *
 * Read through `peek` rather than the bus: the watcher polls while the program
 * runs, and reading through the recording path would paint the memory-map
 * overlay with accesses the program never made.
 */
export function readApple2plusVariables(mem: Apple2Memory): MachineVariable[] {
  return readC64Variables(
    { read: mem.peek, readWord: (addr) => mem.peekWord(addr) },
    APPLESOFT_VARS,
  );
}
