// Escape-code table for the Applesoft BASIC escapes page.
//
// Derived from the Apple II's rather than written: the II Plus is that machine
// with a different BASIC in its ROM sockets, so `src/dialects/apple2plus/`
// imports the sibling's charset outright and an escape is a property of the
// charset alone. Retyping the three rows would have produced a second copy of
// the same measurement, free to drift; taking the sibling's table and renaming
// its header cannot. `escapes/escape-data.test.ts` checks the result like any
// other page, and the crosscheck against the charset runs once for the pair.
//
// What the rows say holds unchanged on this machine. The video-mode bits are
// the board's, not the interpreter's; a byte below 0x80 inside a program line
// is a token here as surely as there; and POKE 50 is the monitor's output mask,
// which both BASICs print through.
import type { EscapeTableData } from '../types';
import { apple2Escapes } from './apple2';

export const applesoftEscapes: EscapeTableData = {
  ...apple2Escapes,
  title: 'Applesoft BASIC escape codes',
  machines: ['Apple II Plus'],
};
