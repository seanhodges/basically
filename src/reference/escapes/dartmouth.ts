// Escape-code table for the Dartmouth BASIC escapes page. Seeded from the
// dialect charset by scripts/gen-escape-scaffold.mts, then hand-enriched. Edit
// by hand; the generator skips this file once it exists. Kept honest by
// escapes/escape-crosscheck.test.ts.
//
// The one table here written in octal, because the machine is octal throughout
// and its characters are six bits rather than eight: there are 64 codes in all,
// 57 of them print something, and the seven that do not are the whole of this
// table. There are no named escapes - no colour, no cursor, no graphics -
// because the terminal is a Teletype printing on paper and there is nothing to
// address. Six of the seven do a job on the machine and get a row each; the
// seventh has no job at all and falls to the catch-all.
import type { EscapeTableData } from '../types';

/** One documented control code, in the shared `{0oNN}` spelling. */
function control(code: number, description: string) {
  const octal = `0o${code.toString(8).padStart(2, '0')}`;
  return {
    escape: `{${octal}}`,
    bytes: octal,
    category: 'control',
    description,
    codes: [code],
    example: { source: `{${octal}}`, bytes: [code] },
  };
}

export const dartmouthEscapes: EscapeTableData = {
  title: 'GE-235 escape codes',
  machines: ['GE-235'],
  categories: [
    // Ringing a gong, moving a carriage, advancing paper and framing a tape are
    // four different jobs, so the chip is a grab-bag: `control`.
    { id: 'control', label: 'Teletype controls', class: 'control' },
    { id: 'raw', label: 'Raw codes', class: 'raw-byte' },
  ],
  entries: [
    control(
      0o32,
      'Bell. On a Teletype Model 33 this struck a physical gong, which is how the machine got the typist’s attention at the end of a long run. Nothing is audible here — the GE-235 has no audio path of any kind — but the paper counts it as a control code rather than printing a glyph.',
    ),
    control(
      0o37,
      'Carriage return: back to column 0 of the same line, without advancing the paper. On a teletype the return and the paper feed are separate mechanisms, so a line that sends only this one overprints what is already there.',
    ),
    control(
      0o52,
      'Tab. No tab stops are set on this machine and nothing moves for it: PRINT reaches its fifteen-column zones by padding with blanks rather than by tabbing to them, which is why there is no TAB keyword to write it with.',
    ),
    control(
      0o55,
      'End of message: the code that closes a paper tape, and the only thing the reader treats as the end of the input. It frames the tape rather than printing on the paper, so nothing is struck for it.',
    ),
    control(
      0o72,
      'Line feed: the paper advances one line and the carriage stays where it is. PRINT sends a carriage return and then this, and the pair together start a new line.',
    ),
    control(
      0o77,
      'Fill. A punch wrote these into the tape to give the carriage time to finish a return before the next character arrived, and the reader discards them. Nothing is printed for one.',
    ),
    {
      escape: '{0oNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any remaining code with no character to strike, written as its six-bit value in octal — octal because the machine’s own listings are octal throughout. There is exactly one: 0o12, which reaches the compiler as a code its character table marks unusable in a program. The braces cost nothing to reserve as notation, since neither { nor } is a GE-235 character. Recognised in string literals, REM text and DATA bodies.',
      codes: 'rest',
      example: { source: '{0o12}', bytes: [0o12] },
    },
  ],
};
