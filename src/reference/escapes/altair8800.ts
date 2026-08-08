// Escape-code table for the Altair 8800 escapes page. Seeded from the dialect
// charset by scripts/gen-escape-scaffold.mts, then hand-enriched. Edit by hand;
// the generator skips this file once it exists. Kept honest by
// escapes/escape-crosscheck.test.ts.
//
// The shortest table in the project, because the Altair has the simplest
// charset: printable ASCII 0x20-0x7E is itself, and *everything* else is the
// raw-byte escape. There are no named escapes at all - no colour codes, no
// cursor controls, no block graphics - because there is no display to control.
// The handful of control codes the console does act on are documented as rows
// so a program can be written against them, but they keep the `{0xNN}` spelling
// every other non-printing byte has rather than being given names the machine
// never used.
import type { EscapeTableData } from '../types';

/** One individually documented control code, in the shared `{0xNN}` spelling. */
function control(code: number, description: string) {
  const hex = `0x${code.toString(16).toUpperCase().padStart(2, '0')}`;
  return {
    escape: `{${hex}}`,
    bytes: hex,
    category: 'control',
    description,
    codes: [code],
    example: { source: `{${hex}}`, bytes: [code] },
  };
}

export const altair8800Escapes: EscapeTableData = {
  title: 'Altair 8800 escape codes',
  machines: ['MITS Altair 8800'],
  categories: [
    // Bell, backspace, line feed, carriage return and rub out do several
    // different jobs between them, so the chip is a grab-bag: `control`.
    { id: 'control', label: 'Terminal controls', class: 'control' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    control(
      0x07,
      'Bell. On a Teletype ASR-33 this struck a physical gong, and 8K BASIC rings it when the console line buffer fills. Nothing is audible here - the machine has no audio path at all - but the console honours it as a control code rather than printing a glyph.',
    ),
    control(
      0x08,
      "Backspace. A teletype could only move the carriage back a space, so this erases nothing and never climbs to the previous line. BASIC's own line editor rubs out the last character typed with 0x5F (underline) instead.",
    ),
    control(
      0x0a,
      'Line feed: down one row, leaving the column where it was. BASIC always sends a carriage return first, so the pair together start a new line.',
    ),
    control(
      0x0d,
      'Carriage return: back to column 0 of the same row, without advancing.',
    ),
    control(
      0x7f,
      "Rub out - all eight holes punched on paper tape, and what the teletype's RUB OUT key sends. Nothing is printed for it.",
    ),
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any byte with no printable form, as two hex digits: the rest of the control codes 0x00-0x1F, and the whole of 0x80-0xFF. The console never displays the high range - BASIC masks its output to seven bits - but a string can still hold it, and ASC(CHR$(255)) really is 255. Recognised in strings, REM and DATA; a { that is not an escape is the literal 0x7B character.',
      codes: 'rest',
      example: { source: '{0x00}', bytes: [0x00] },
    },
  ],
};
