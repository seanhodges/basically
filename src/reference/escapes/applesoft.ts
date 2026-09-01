// Escape-code table for the Applesoft BASIC escapes page.
//
// Derived from the Apple II's rather than written: the II Plus is that machine
// with a different BASIC in its ROM sockets, so `src/dialects/apple2plus/`
// imports the sibling's charset outright and an escape is a property of the
// charset alone. Retyping the three rows would have produced a second copy of
// the same measurement, free to drift; taking the sibling's rows cannot.
// `escapes/escape-data.test.ts` checks the result like any other page, and the
// crosscheck against the charset runs once for the pair.
//
// The sibling's rows are the Apple II's share of the Integer BASIC page, which
// it splits with the Apple I: they are selected by the scoping that page uses
// and then unscoped, because `apple2` is not a machine this page covers and the
// Apple I's rows are not this machine's.
//
// What the rows say holds unchanged on this machine. The video-mode bits are
// the board's, not the interpreter's; a byte below 0x80 inside a program line
// is a token here as surely as there; and POKE 50 is the monitor's output mask,
// which both BASICs print through.
import type { EscapeTableData } from '../types';
import { integerBasicEscapes } from './integer-basic';

const rows = integerBasicEscapes.entries
  .filter((e) => !e.onlyOn || e.onlyOn.includes('apple2'))
  .map((e) => {
    const row = { ...e };
    delete row.onlyOn;
    delete row.tag;
    return row;
  });

export const applesoftEscapes: EscapeTableData = {
  ...integerBasicEscapes,
  title: 'Applesoft BASIC escape codes',
  machines: ['Apple II Plus'],
  categories: integerBasicEscapes.categories.filter((c) =>
    rows.some((e) => e.category === c.id),
  ),
  entries: rows,
};
