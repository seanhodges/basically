// Escape-code table for the Apple I escapes page. Seeded from the dialect
// charset by scripts/gen-escape-scaffold.mts, then hand-enriched. Edit by hand;
// the generator skips this file once it exists. Kept honest by
// escapes/escape-crosscheck.test.ts.
//
// Shorter even than the Altair's, and for a blunter reason: this machine has 64
// characters and no sixty-fifth. The character generator holds ASCII 0x20-0x5F,
// which the machine carries with bit 7 set - so 0xA0-0xDF are the printable
// codes and every one of the other 192 is the raw-byte escape. There are no
// named escapes at all: no colour, no cursor controls, no block graphics, and
// no lower case. The three codes the machine itself acts on are documented as
// rows so a program can be written against them, but they keep the {0xNN}
// spelling every other non-printing byte has, because the machine never gave
// them names either.
import type { EscapeTableData } from '../types';

/** One individually documented code, in the shared `{0xNN}` spelling. */
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

export const apple1Escapes: EscapeTableData = {
  title: 'Apple I escape codes',
  machines: ['Apple I'],
  categories: [
    { id: 'control', label: 'Codes the machine acts on', class: 'control' },
    { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
  ],
  entries: [
    control(
      0x83,
      'CTRL-C. Sent by the keyboard as the letter with bits 5 and 6 cleared, and the code that breaks a running program - although so does every other key, because BASIC takes whatever is waiting and reports STOPPED AT.',
    ),
    control(
      0x8d,
      'Carriage return: the start of the next line. The only code the display decodes at all - there is no line feed, no backspace, no clear-screen and no cursor addressing, so this is the whole of the line discipline.',
    ),
    control(
      0x9b,
      'Escape. The monitor reads it as "abandon the line being typed"; the display prints nothing for it.',
    ),
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any byte with no printable form, as two hex digits: everything outside 0xA0-0xDF, which is the whole of 0x00-0x9F and 0xE0-0xFF. The display discards a code it has no glyph for rather than guessing at one, but a string can still hold it. Recognised in strings and REM; note that { and } are not characters this machine has, so an escape is the only way either reaches a program at all.',
      codes: 'rest',
      example: { source: '{0x00}', bytes: [0x00] },
    },
  ],
};
