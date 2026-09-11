// Escape-code table for the Dartmouth BASIC escapes page, which two machines
// read. Seeded from the GE-235's charset by scripts/gen-escape-scaffold.mts,
// then hand-enriched. Edit by hand; the generator skips this file once it
// exists. Kept honest by escapes/escape-crosscheck.test.ts.
//
// **Every row here is scoped to one machine**, because these two share a BASIC
// and not a character set. The GE-235's characters are six bits and its
// listings are octal throughout, so its codes are written `{0oNN}` and there
// are 64 of them. The GE-635's are ASCII - section 2.7 of *BASIC, Fourth
// Edition* prints the table and states its width, "128 characters numbered 0
// through 127" - so its codes are written `{0xNN}`, the spelling every other
// ASCII machine here uses. Each machine therefore carries its own catch-all
// row as well; escape-data.test.ts allows the second only because both are
// scoped.
//
// Neither machine has a named escape - no colour, no cursor, no graphics -
// because the terminal is a Teletype printing on paper and there is nothing to
// address. What is left is the handful of codes that work the machine rather
// than the paper, and each gets a row.
import type { EscapeTableData } from '../types';

/** The GE-235's machines, and the GE-635's, as every row below is scoped. */
const GE235 = ['ge235'];
const GE635 = ['ge635'];

/** One documented GE-235 control code, in that machine's octal spelling. */
function octal(code: number, description: string) {
  const spelling = `0o${code.toString(8).padStart(2, '0')}`;
  return {
    escape: `{${spelling}}`,
    bytes: spelling,
    category: 'control',
    description,
    codes: [code],
    example: { source: `{${spelling}}`, bytes: [code] },
    onlyOn: GE235,
  };
}

/** One documented GE-635 control code, in that machine's hexadecimal one. */
function hex(code: number, description: string) {
  const spelling = `0x${code.toString(16).toUpperCase().padStart(2, '0')}`;
  return {
    escape: `{${spelling}}`,
    bytes: spelling,
    category: 'control',
    description,
    codes: [code],
    example: { source: `{${spelling}}`, bytes: [code] },
    onlyOn: GE635,
  };
}

export const dartmouthEscapes: EscapeTableData = {
  title: 'Dartmouth BASIC escape codes',
  machines: ['GE-235', 'GE-635'],
  categories: [
    // Ringing a gong, moving a carriage, advancing paper and framing a tape are
    // four different jobs, so the chip is a grab-bag: `control`.
    { id: 'control', label: 'Teletype controls', class: 'control' },
    { id: 'raw', label: 'Raw codes', class: 'raw-byte' },
  ],
  entries: [
    octal(
      0o32,
      'Bell. On a Teletype Model 33 this struck a physical gong, which is how the machine got the typist’s attention at the end of a long run. Nothing is audible here — the GE-235 has no audio path of any kind — but the paper counts it as a control code rather than printing a glyph.',
    ),
    octal(
      0o37,
      'Carriage return: back to column 0 of the same line, without advancing the paper. On a teletype the return and the paper feed are separate mechanisms, so a line that sends only this one overprints what is already there.',
    ),
    octal(
      0o52,
      'Tab. No tab stops are set on this machine and nothing moves for it: PRINT reaches its fifteen-column zones by padding with blanks rather than by tabbing to them, which is why there is no TAB keyword to write it with.',
    ),
    octal(
      0o55,
      'End of message: the code that closes a paper tape, and the only thing the reader treats as the end of the input. It frames the tape rather than printing on the paper, so nothing is struck for it.',
    ),
    octal(
      0o72,
      'Line feed: the paper advances one line and the carriage stays where it is. PRINT sends a carriage return and then this, and the pair together start a new line.',
    ),
    octal(
      0o77,
      'Fill. A punch wrote these into the tape to give the carriage time to finish a return before the next character arrived, and the reader discards them. Nothing is printed for one.',
    ),
    {
      escape: '{0oNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any remaining GE-235 code with no character to strike, written as its six-bit value in octal — octal because the machine’s own listings are octal throughout. There is exactly one: 0o12, which reaches the compiler as a code its character table marks unusable in a program. The braces cost nothing to reserve as notation, since neither { nor } is a GE-235 character. Recognised in string literals, REM text and DATA bodies.',
      codes: 'rest',
      example: { source: '{0o12}', bytes: [0o12] },
      onlyOn: GE235,
    },
    hex(
      0x04,
      'End of transmission, which section 2.7 says "turns off the teletype". It is the code a timesharing line hung up on, and it prints nothing on the way past.',
    ),
    hex(
      0x07,
      'Bell: the gong on the Teletype Model 33, struck to tell a typist a long run had finished. There is no audio path on this machine either, so nothing is heard here and the paper is unmarked.',
    ),
    hex(
      0x0a,
      'Line feed: the paper advances one line and the carriage stays where it is. PRINT sends a carriage return and then this, and the pair together start a new line.',
    ),
    hex(
      0x0d,
      'Carriage return: back to column 0 of the same line, without advancing the paper. The return and the paper feed are separate mechanisms on a teletype, so a line that sends only this one overprints what is already there.',
    ),
    hex(
      0x7f,
      'Rub-out, which section 2.7 marks "(tape use only)". A punch overstruck a mistake with every hole in the column, and the reader threw the character away; nothing is printed for one.',
    ),
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any GE-635 code with no character to strike, written as its seven-bit value in hexadecimal. Section 2.7 gives characters to 32 through 95 and nothing else, so this covers every code below the space and everything from 96 up — the lower-case half of ASCII among them, which a Model 33 has no keys or type bars for. Recognised in string literals, REM text and DATA bodies.',
      codes: 'rest',
      example: { source: '{0x1B}', bytes: [0x1b] },
      onlyOn: GE635,
    },
  ],
};
